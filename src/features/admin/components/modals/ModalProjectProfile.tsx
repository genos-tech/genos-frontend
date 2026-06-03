// `sort-keys` is disabled file-wide: this 1200-line modal carries ~80
// violations in Joy UI `sx` prop objects whose visual grouping
// (positioning vs sizing vs typography) is intentional and not worth
// re-sorting given the punch-list note above marks the modal as dead
// code once the v3 channel-update path replaces these legacy services.
// `simple-import-sort` is disabled because the prettier import-sort
// plugin disagrees with it on react-vs-@mui ordering; prettier wins.
/* eslint-disable react/jsx-sort-props */
import { useEffect, useMemo, useRef, useState } from "react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SearchIcon from "@mui/icons-material/Search";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import {
    Avatar,
    Box,
    Button,
    Card,
    FormControl,
    FormLabel,
    IconButton,
    Input,
    ListItemButton,
    Modal,
    ModalClose,
    ModalDialog,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { FileSizeRejectionSnackbar } from "../../../../components/ui/feedback/FileSizeRejectionSnackbar";
import { useFileSizeGuard } from "../../../../components/ui/feedback/useFileSizeGuard";
import { ModalLeaveConfirm } from "../../../../components/ui/misc/ModalLeaveConfirm";
import { ModalTransferOwner } from "../../../../components/ui/misc/ModalTransferOwner";
import { ProfileModalStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { loadProjectProfile } from "../../../../services/loadProjectProfile";
import { purplePalette } from "../../../../theme/purplePalette";
import { ProjectProfileProps, UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { resolveLegacyChatId } from "../../../chat/utils/channelIdResolvers";
import { leaveProject } from "../../services/leaveProject";
import { updateProjectProfile } from "../../services/updateProjectProfile";

const base_url = import.meta.env.VITE_API_BASE_URL;
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type ModalProjectProfileProps = {
    socket: Socket | null;
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    pmChat: AllChatProps;
    openModalProjectProfile: boolean;
    setOpenModalProjectProfile: (value: boolean) => void;
    setAvatarUserId: (value: string) => void;
    setOpenUserProfile: (value: boolean) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};
export const ModalProjectProfile = (props: ModalProjectProfileProps) => {
    const {
        socket,
        useTEM,
        myself,
        setMyself,
        pmChat,
        openModalProjectProfile,
        setOpenModalProjectProfile,
        setAvatarUserId,
        setOpenUserProfile,
        useCM,
        useUISM,
    } = props;

    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const styles = isDark ? ProfileModalStyles.dark : ProfileModalStyles.light;
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    // Resolve the legacy integer `project_id` from the v3 channel UUID
    // via `Channel.legacyChatId`. Every legacy project service this
    // modal calls (`updateProjectProfile`, `leaveProject`,
    // `deletePMChatData`, `loadProjectProfile`, and the inline image
    // / code PUT below) binds its backend URL param to a Django
    // `IntegerField`. Passing a UUID 500s.
    //
    // Returns `-1` when no v3 mirror exists; downstream calls 404
    // benignly rather than 500-with-traceback.
    const pmChatIdLegacy = resolveLegacyChatId(pmChat.chatId) ?? -1;

    const [projectProfile, setProjectProfile] = useState<ProjectProfileProps | null>(null);

    // Pull the live chat row from `useCM.allChats` so the avatar reflects
    // the freshest `profileImagePath` after a profile-image upload calls
    // `syncChannel` + `funcSetAllChats` below. The `pmChat` prop is
    // captured by the parent at modal-open time and otherwise goes stale —
    // mirrors the `liveChat` pattern in ModalGMProfile.
    const liveChat = useMemo(() => {
        const found = useCM.allChats.find(
            (c) => c.chatId === pmChat.chatId && c.chatType === pmChat.chatType
        );
        return found ?? pmChat;
    }, [useCM.allChats, pmChat]);

    // Member search state
    const [memberSearchQuery, setMemberSearchQuery] = useState("");

    // Editable project code state. The chip flips to an Input when the
    // user clicks the pencil; Save fires PUT /project/ to persist.
    const [codeEditMode, setCodeEditMode] = useState(false);
    const [codeDraft, setCodeDraft] = useState("");
    const [codeError, setCodeError] = useState<string | null>(null);
    const [codeSaving, setCodeSaving] = useState(false);

    // Leave-project flow. Owners can't leave (would orphan the project);
    // ownership is loaded async (projectProfile may be null on first
    // open) so the button is gated on both projectProfile presence and
    // ownerUserId mismatch.
    const [openLeaveConfirm, setOpenLeaveConfirm] = useState(false);
    const isProjectOwner = !!projectProfile && myself.userId === projectProfile.ownerUserId;
    const canShowLeave = !!projectProfile && !isProjectOwner;

    // Inline rename + transfer-ownership flow (owner-only). Mirrors the
    // pattern in ModalTeamProfile: PUT through `updateProjectProfile`,
    // update the local profile state on success so the modal reflects
    // the change without a refetch.
    const [nameEditMode, setNameEditMode] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);
    const [nameSaving, setNameSaving] = useState(false);
    const [openTransfer, setOpenTransfer] = useState(false);

    const handleNameSave = async () => {
        if (!projectProfile) return;
        const next = nameDraft.trim();
        if (!next) {
            setNameError(t.common.profileEdit.nameEmpty);
            return;
        }
        if (next === (projectProfile?.projectName ?? pmChat.chatName)) {
            setNameEditMode(false);
            setNameError(null);
            return;
        }
        setNameSaving(true);
        setNameError(null);
        const ok = await updateProjectProfile(
            accessToken,
            pmChatIdLegacy,
            { projectName: next },
            setNameError
        );
        setNameSaving(false);
        if (ok) {
            setProjectProfile({ ...projectProfile, projectName: next });
            // Reflect rename in the chat-list row too so the sidebar
            // updates immediately. `funcSetAllChats` overwrites this
            // entry on next sync anyway.
            useCM.setAllChats((prev) =>
                prev.map((c) =>
                    c.chatType === pmChat.chatType && c.chatId === pmChat.chatId
                        ? { ...c, chatName: next }
                        : c
                )
            );
            setNameEditMode(false);
        }
    };

    const handleTransferConfirm = async (newOwnerId: string) => {
        if (!projectProfile) return false;
        const ok = await updateProjectProfile(accessToken, pmChatIdLegacy, {
            ownerId: newOwnerId,
        });
        if (ok) {
            setProjectProfile({ ...projectProfile, ownerUserId: newOwnerId });
            setOpenTransfer(false);
        }
        return ok;
    };

    const transferCandidates = useMemo(
        () =>
            (projectProfile?.projectMembers ?? [])
                .filter((m) => m.userId !== myself.userId)
                .map((m) => ({
                    userId: m.userId,
                    userName: m.userName,
                    userEmail: m.userEmail,
                    avatarImgPath: m.avatarImgPath,
                })),
        [projectProfile?.projectMembers, myself.userId]
    );

    const handleLeaveProject = async () => {
        if (!myself.teamId) return false;
        const ok = await leaveProject(accessToken, myself.teamId, pmChatIdLegacy, myself.userId);
        if (!ok) return false;
        // Drop the project chat from the in-memory list so the sidebar
        // updates immediately.
        useCM.setAllChats((prev) =>
            prev.filter((c) => !(c.chatType === pmChat.chatType && c.chatId === pmChat.chatId))
        );
        if (
            useCM.currentMainChat?.chatType === pmChat.chatType &&
            useCM.currentMainChat?.chatId === pmChat.chatId
        ) {
            useCM.setCurrentMainChat(undefined);
        }
        if (
            useCM.currentSubChat?.chatType === pmChat.chatType &&
            useCM.currentSubChat?.chatId === pmChat.chatId
        ) {
            useCM.setCurrentSubChat(undefined);
        }
        // v3 ownership: when the user is removed from the project's
        // channel, the v3 `channel.member_removed` broadcast triggers
        // `channelService._evictChannelMessages`, which drops the
        // channel from the snapshot + IDB. No manual cleanup needed.
        setOpenModalProjectProfile(false);
        return true;
    };

    const handleCodeSave = async () => {
        if (!projectProfile?.projectId) return;
        const next = codeDraft.trim().toUpperCase();
        if (!/^[A-Z][A-Z0-9]{1,5}$/.test(next)) {
            setCodeError("2-6 chars, letters & digits, start with a letter.");
            return;
        }
        setCodeSaving(true);
        setCodeError(null);
        try {
            const res = await fetch(`${base_url}/project/`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    project_id: projectProfile.projectId,
                    code: next,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setCodeError(body.error || `Save failed (${res.status})`);
                return;
            }
            setProjectProfile({ ...projectProfile, code: next });
            setCodeEditMode(false);
        } catch {
            setCodeError("Network error.");
        } finally {
            setCodeSaving(false);
        }
    };

    // Filter members based on search query
    const filteredMembers = useMemo(() => {
        if (!projectProfile?.projectMembers) return [];
        if (!memberSearchQuery.trim()) {
            return projectProfile.projectMembers;
        }
        const query = memberSearchQuery.toLowerCase();
        return projectProfile.projectMembers.filter(
            (member) =>
                member.userName.toLowerCase().includes(query) ||
                member.userEmail.toLowerCase().includes(query)
        );
    }, [projectProfile?.projectMembers, memberSearchQuery]);

    // Profile image file upload manager
    const inputRef = useRef<HTMLInputElement | null>(null);
    const handleButtonClick = () => {
        inputRef.current?.click();
    };

    // Per-file size cap. Profile images are tiny by nature; the cap is
    // mostly a safety net against accidentally selecting a 4K RAW.
    const { rejection, dismissRejection, filterFiles } = useFileSizeGuard();

    const handleSelectedFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (pmChat.project) {
            const selectedFiles = event.target.files;
            if (!selectedFiles || selectedFiles.length !== 1) return;

            const accepted = filterFiles(selectedFiles);
            if (accepted.length === 0) {
                event.target.value = "";
                return;
            }

            const tmpProjectProfileImage = accepted[0]; // original File

            // Create a new File instance with the existing file data but new name
            const imageFileName = "profile.jpg";
            const userProfileImage = new File([tmpProjectProfileImage], imageFileName, {
                type: tmpProjectProfileImage.type,
                lastModified: tmpProjectProfileImage.lastModified,
            });

            const formData = new FormData();
            formData.append("profile_image", userProfileImage);
            formData.append("project_id", pmChat.project.projectId.toString());
            const uploadProfileImageResponse = await fetch(`${base_url}/project/profile/image/`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: formData,
            });

            const uploadProfileImageData = await uploadProfileImageResponse.json();

            if (!uploadProfileImageResponse.ok) {
                throw new Error(t.admin.projectProfile.uploadFailed);
            }
            // v3 source. The PM channel mirrors the ProjectMaster row:
            // the `_ensure_pm_channel_for_project` signal copies the new
            // `profile_image_file_name` onto `Channel.profile_image_url`
            // when the upload saves the project. But the legacy image
            // endpoint does NOT fan out a `channel.updated` broadcast, so
            // our own snapshot is stale — pull the channel fresh via
            // `syncChannel` first, THEN re-derive `allChats` so `liveChat`
            // (and the sidebar `ProjectAvatar`) pick up the new image.
            // Mirrors the GM upload flow.
            await channelService.syncChannel(pmChat.chatId);
            await useCM.funcSetAllChats();
        }
    };

    const loadProjectProfileData = async () => {
        const projectProfile = await loadProjectProfile(
            myself.teamId,
            pmChatIdLegacy,
            accessToken
        );
        setProjectProfile(projectProfile);
    };

    useEffect(() => {
        if (openModalProjectProfile) {
            loadProjectProfileData();
        }
        // Intentional: load on open only. Including `loadProjectProfileData`
        // would refire whenever the closure rebinds (every render); we
        // only want one fetch per open transition.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openModalProjectProfile]);

    return (
        <>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
            <Modal
                open={openModalProjectProfile}
                sx={{
                    zIndex: 10001,
                    backdropFilter: "blur(8px)",
                    backgroundColor: "transparent",
                }}
                onClose={() => setOpenModalProjectProfile(false)}
            >
                <ModalDialog
                    sx={{
                        background: styles.bg,
                        border: `1px solid ${styles.border}`,
                        boxShadow: styles.shadow,
                        borderRadius: { xs: "0", md: "20px" },
                        overflow: "auto",
                        transition: "all 0.3s ease",
                        // Fill the viewport on mobile so the modal feels
                        // native; cap at 1000px on desktop to match the
                        // original layout.
                        width: { xs: "100vw", md: "auto" },
                        height: { xs: "100dvh", md: "auto" },
                        maxWidth: { xs: "100vw", md: "1000px" },
                        maxHeight: { xs: "100dvh", md: "90vh" },
                        m: { xs: 0, md: "auto" },
                    }}
                >
                    <Box
                        sx={{
                            flex: 1,
                            width: { xs: "100%", md: "1000px" },
                            maxWidth: "100%",
                        }}
                    >
                        <Box
                            sx={{
                                position: "sticky",
                                top: { sm: -100, md: -110 },
                                zIndex: 9995,
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 1,
                                    px: { xs: 2, md: 3 },
                                }}
                            >
                                <Typography
                                    component="h1"
                                    level="h2"
                                    sx={{
                                        mt: 1,
                                        mb: 1,
                                        flex: 1,
                                        minWidth: 0,
                                        background: styles.headerGradient,
                                        backgroundClip: "text",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                        fontWeight: 700,
                                        letterSpacing: "-0.02em",
                                        fontSize: { xs: "1.4rem", md: "1.875rem" },
                                    }}
                                    noWrap
                                >
                                    {fmt(t.admin.projectProfile.title, {
                                        projectName:
                                            projectProfile?.projectName ?? pmChat.chatName,
                                    })}
                                </Typography>
                                {/* Close button — without it mobile users
                                    have no way to dismiss the modal,
                                    since it's full-screen on xs and
                                    there's no backdrop to click. */}
                                <ModalClose
                                    variant="plain"
                                    sx={{
                                        position: "static",
                                        flexShrink: 0,
                                    }}
                                />
                            </Box>
                        </Box>

                        <Stack
                            spacing={4}
                            sx={{
                                display: "flex",
                                mx: "auto",
                                px: { xs: 2, md: 6 },
                                py: { xs: 2, md: 3 },
                            }}
                        >
                            <Card
                                sx={{
                                    background: styles.cardBg,
                                    border: `1px solid ${styles.border}`,
                                    borderRadius: "16px",
                                    boxShadow: isDark
                                        ? "0 4px 20px rgba(0,0,0,0.3)"
                                        : "0 4px 20px rgba(124,58,237,0.08)",
                                    transition: "all 0.3s ease",
                                    "&:hover": {
                                        boxShadow: isDark
                                            ? "0 8px 30px rgba(0,0,0,0.4)"
                                            : "0 8px 30px rgba(124,58,237,0.12)",
                                    },
                                }}
                            >
                                <Stack
                                    direction={{ xs: "column", md: "row" }}
                                    alignItems={{ xs: "stretch", md: "flex-start" }}
                                    sx={{
                                        display: "flex",
                                        my: 1,
                                        width: "100%",
                                        minWidth: 0,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            pl: { xs: 0, md: "20px" },
                                            pr: { xs: 0, md: "40px" },
                                            mb: { xs: 2, md: 0 },
                                            position: "relative",
                                            display: "inline-block",
                                            alignSelf: { xs: "center", md: "auto" },
                                        }}
                                    >
                                        <Avatar
                                            src={`${media_url}/${liveChat.profileImagePath}`}
                                            sx={{
                                                width: 180,
                                                height: 180,
                                                fontSize: "50px",
                                                boxShadow: styles.avatarGlow,
                                                border: `3px solid ${styles.border}`,
                                                transition: "all 0.3s ease",
                                                "&:hover": {
                                                    transform: "scale(1.02)",
                                                    boxShadow: isDark
                                                        ? "0 0 50px rgba(124,58,237,0.5), 0 0 100px rgba(139,92,246,0.3)"
                                                        : "0 0 50px rgba(124,58,237,0.3), 0 0 100px rgba(139,92,246,0.15)",
                                                },
                                            }}
                                        >
                                            <AssignmentIcon sx={{ fontSize: 100 }} />
                                        </Avatar>

                                        <Box
                                            sx={{
                                                position: "absolute",
                                                top: 150,
                                                right: 30,
                                            }}
                                        >
                                            <input
                                                ref={inputRef}
                                                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                                multiple={false}
                                                style={{ display: "none" }}
                                                type="file"
                                                onChange={handleSelectedFiles}
                                            />
                                            <Tooltip
                                                size="sm"
                                                sx={{ zIndex: 9000 }}
                                                title={t.admin.projectProfile.editProfileImage}
                                                variant="outlined"
                                            >
                                                <IconButton
                                                    variant="soft"
                                                    sx={{
                                                        background: isDark
                                                            ? "linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(139,92,246,0.3) 100%)"
                                                            : "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(139,92,246,0.15) 100%)",
                                                        border: `1px solid ${styles.border}`,
                                                        transition: "all 0.2s ease",
                                                        "&:hover": {
                                                            background: isDark
                                                                ? "linear-gradient(135deg, rgba(124,58,237,0.5) 0%, rgba(139,92,246,0.5) 100%)"
                                                                : "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(139,92,246,0.25) 100%)",
                                                            transform: "scale(1.1)",
                                                        },
                                                    }}
                                                    onClick={() => {
                                                        if (pmChat.project) {
                                                            handleButtonClick();
                                                        } else {
                                                            console.error("Project not found");
                                                        }
                                                    }}
                                                >
                                                    <EditIcon
                                                        sx={{
                                                            fontSize: "30px",
                                                            color: styles.accentColor,
                                                        }}
                                                    />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>

                                    <Stack
                                        spacing={2}
                                        sx={{
                                            flexGrow: 1,
                                            minWidth: 0,
                                            width: "100%",
                                            maxWidth: "100%",
                                        }}
                                    >
                                        <Stack direction="column" spacing={1.5}>
                                            {/* Project name — inline rename for owners. */}
                                            <FormControl>
                                                <FormLabel
                                                    sx={{
                                                        color: styles.labelColor,
                                                        fontSize: "0.75rem",
                                                        fontWeight: 600,
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.05em",
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    Project name
                                                </FormLabel>
                                                {nameEditMode ? (
                                                    <Stack
                                                        direction="row"
                                                        spacing={1}
                                                        alignItems="center"
                                                    >
                                                        <Input
                                                            size="sm"
                                                            autoFocus
                                                            value={nameDraft}
                                                            onChange={(e) =>
                                                                setNameDraft(e.target.value)
                                                            }
                                                            // See ModalTeamProfile for the
                                                            // rationale on routing keydown through
                                                            // slotProps.input.
                                                            slotProps={{
                                                                input: {
                                                                    onKeyDown: (e) => {
                                                                        if (e.key === "Enter") {
                                                                            e.preventDefault();
                                                                            void handleNameSave();
                                                                        }
                                                                        if (e.key === "Escape") {
                                                                            setNameEditMode(false);
                                                                            setNameError(null);
                                                                        }
                                                                    },
                                                                },
                                                            }}
                                                            sx={{
                                                                flex: 1,
                                                                "--Input-radius": "8px",
                                                            }}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            variant="solid"
                                                            loading={nameSaving}
                                                            onClick={handleNameSave}
                                                        >
                                                            {t.common.profileEdit.save}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="plain"
                                                            color="neutral"
                                                            onClick={() => {
                                                                setNameEditMode(false);
                                                                setNameError(null);
                                                            }}
                                                        >
                                                            {t.common.profileEdit.cancel}
                                                        </Button>
                                                    </Stack>
                                                ) : (
                                                    <Stack
                                                        direction="row"
                                                        spacing={1}
                                                        alignItems="center"
                                                    >
                                                        <Typography
                                                            fontWeight="bold"
                                                            sx={{
                                                                userSelect: "text",
                                                                color: styles.valueColor,
                                                                fontSize: "18px",
                                                            }}
                                                        >
                                                            {projectProfile?.projectName ??
                                                                pmChat.chatName}
                                                        </Typography>
                                                        {isProjectOwner && (
                                                            <AppTooltip
                                                                title={t.common.profileEdit.rename}
                                                                size="sm"
                                                            >
                                                                <IconButton
                                                                    size="sm"
                                                                    variant="plain"
                                                                    onClick={() => {
                                                                        setNameDraft(
                                                                            projectProfile?.projectName ??
                                                                                pmChat.chatName
                                                                        );
                                                                        setNameError(null);
                                                                        setNameEditMode(true);
                                                                    }}
                                                                >
                                                                    <EditIcon
                                                                        sx={{ fontSize: 16 }}
                                                                    />
                                                                </IconButton>
                                                            </AppTooltip>
                                                        )}
                                                    </Stack>
                                                )}
                                                {nameError && (
                                                    <Typography
                                                        level="body-xs"
                                                        sx={{
                                                            color: palette.dangerTint,
                                                            mt: 0.5,
                                                        }}
                                                    >
                                                        {nameError}
                                                    </Typography>
                                                )}
                                            </FormControl>

                                            <FormControl>
                                                <FormLabel
                                                    sx={{
                                                        color: styles.labelColor,
                                                        fontSize: "0.75rem",
                                                        fontWeight: 600,
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.05em",
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    {t.admin.projectProfile.owner}
                                                </FormLabel>
                                                {/* Name + email on one (wrap-friendly) row,
                                                    Transfer button on its own row below. */}
                                                <Stack
                                                    direction="row"
                                                    alignItems="center"
                                                    spacing={2}
                                                    sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                                                >
                                                    <Button
                                                        color="neutral"
                                                        variant="plain"
                                                        sx={{
                                                            justifyContent: "flex-start",
                                                            px: 1.5,
                                                            py: 0.5,
                                                            borderRadius: "8px",
                                                            transition: "all 0.2s ease",
                                                            "&:hover": {
                                                                background: styles.hoverBg,
                                                            },
                                                        }}
                                                        onClick={() => {
                                                            if (projectProfile?.ownerUserId) {
                                                                setAvatarUserId(
                                                                    projectProfile.ownerUserId
                                                                );
                                                                setOpenUserProfile(true);
                                                            }
                                                        }}
                                                    >
                                                        <Typography
                                                            fontWeight="bold"
                                                            sx={{
                                                                userSelect: "text",
                                                                fontSize: "20px",
                                                                color: styles.valueColor,
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            {projectProfile
                                                                ? useTEM.teamMemberProfiles[
                                                                      projectProfile?.ownerUserId
                                                                  ]?.userName
                                                                : t.admin.projectProfile
                                                                      .notAvailable}
                                                        </Typography>
                                                    </Button>
                                                    <Typography
                                                        component="a"
                                                        href={`mailto:${
                                                            projectProfile
                                                                ? useTEM.teamMemberProfiles[
                                                                      projectProfile?.ownerUserId
                                                                  ]?.userEmail
                                                                : t.admin.projectProfile
                                                                      .notAvailable
                                                        }`}
                                                        startDecorator={
                                                            <EmailRoundedIcon
                                                                fontSize="small"
                                                                sx={{
                                                                    color: styles.accentColor,
                                                                }}
                                                            />
                                                        }
                                                        sx={{
                                                            textDecoration: "none",
                                                            color: styles.valueColor,
                                                            cursor: "pointer",
                                                            transition: "all 0.2s ease",
                                                            "&:hover": {
                                                                color: styles.accentColor,
                                                            },
                                                        }}
                                                    >
                                                        {projectProfile
                                                            ? useTEM.teamMemberProfiles[
                                                                  projectProfile?.ownerUserId
                                                              ]?.userEmail
                                                            : t.admin.projectProfile.notAvailable}
                                                    </Typography>
                                                </Stack>
                                                {isProjectOwner && (
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            justifyContent: "flex-end",
                                                            mt: 1,
                                                            mb: 1.5,
                                                        }}
                                                    >
                                                        <Button
                                                            size="sm"
                                                            variant="outlined"
                                                            color="neutral"
                                                            startDecorator={
                                                                <SwapHorizRoundedIcon
                                                                    sx={{ fontSize: 16 }}
                                                                />
                                                            }
                                                            onClick={() => setOpenTransfer(true)}
                                                            sx={{ borderRadius: "8px" }}
                                                        >
                                                            {t.common.profileEdit.transferOwner}
                                                        </Button>
                                                    </Box>
                                                )}
                                            </FormControl>

                                            <FormControl>
                                                <Stack
                                                    direction={{ xs: "column", sm: "row" }}
                                                    alignItems={{
                                                        xs: "stretch",
                                                        sm: "center",
                                                    }}
                                                    justifyContent="space-between"
                                                    spacing={{ xs: 1, sm: 0 }}
                                                    sx={{ mb: 1 }}
                                                >
                                                    <FormLabel
                                                        sx={{
                                                            color: styles.labelColor,
                                                            fontSize: "0.75rem",
                                                            fontWeight: 600,
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.05em",
                                                            mb: 0,
                                                        }}
                                                    >
                                                        {fmt(t.admin.projectProfile.members, {
                                                            filtered: filteredMembers.length,
                                                            total:
                                                                projectProfile?.projectMembers
                                                                    ?.length || 0,
                                                        })}
                                                    </FormLabel>
                                                    <Input
                                                        placeholder={
                                                            t.admin.projectProfile.searchMembers
                                                        }
                                                        value={memberSearchQuery}
                                                        onChange={(e) =>
                                                            setMemberSearchQuery(e.target.value)
                                                        }
                                                        startDecorator={
                                                            <SearchIcon
                                                                sx={{
                                                                    color: styles.accentColor,
                                                                    fontSize: "18px",
                                                                }}
                                                            />
                                                        }
                                                        endDecorator={
                                                            memberSearchQuery && (
                                                                <IconButton
                                                                    size="sm"
                                                                    variant="plain"
                                                                    onClick={() =>
                                                                        setMemberSearchQuery("")
                                                                    }
                                                                    sx={{
                                                                        minWidth: "24px",
                                                                        minHeight: "24px",
                                                                        borderRadius: "50%",
                                                                    }}
                                                                >
                                                                    <CloseIcon
                                                                        sx={{ fontSize: "16px" }}
                                                                    />
                                                                </IconButton>
                                                            )
                                                        }
                                                        sx={{
                                                            width: { xs: "100%", sm: "220px" },
                                                            maxWidth: "100%",
                                                            "--Input-focusedThickness": "1px",
                                                            "--Input-radius": "8px",
                                                            background: isDark
                                                                ? "rgba(0,0,0,0.3)"
                                                                : "rgba(255,255,255,0.8)",
                                                            border: `1px solid ${styles.border}`,
                                                            fontSize: "14px",
                                                            transition: "all 0.2s ease",
                                                            "&:hover": {
                                                                borderColor: styles.accentColor,
                                                            },
                                                            "&:focus-within": {
                                                                borderColor: styles.accentColor,
                                                                boxShadow: isDark
                                                                    ? "0 0 0 2px rgba(124,58,237,0.2)"
                                                                    : "0 0 0 2px rgba(124,58,237,0.1)",
                                                            },
                                                        }}
                                                    />
                                                </Stack>
                                                <Box
                                                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                                                    sx={{
                                                        maxHeight: "300px",
                                                        overflow: "auto",
                                                        background: isDark
                                                            ? "rgba(0,0,0,0.2)"
                                                            : "rgba(124,58,237,0.03)",
                                                        borderRadius: "12px",
                                                        border: `1px solid ${styles.border}`,
                                                        p: 1,
                                                    }}
                                                >
                                                    {filteredMembers.length > 0 ? (
                                                        filteredMembers.map((member) => (
                                                            <ListItemButton
                                                                key={`project-member-${member.userId}`}
                                                                sx={{
                                                                    ml: 1,
                                                                    my: 0.3,
                                                                    borderRadius: "8px",
                                                                    transition: "all 0.2s ease",
                                                                    "&:hover": {
                                                                        background: styles.hoverBg,
                                                                    },
                                                                }}
                                                                onClick={() => {
                                                                    setAvatarUserId(member.userId);
                                                                    setOpenUserProfile(true);
                                                                }}
                                                            >
                                                                <AvatarWithStatus
                                                                    avatarUser={member}
                                                                    clickable={false}
                                                                    useCM={useCM}
                                                                    isYou={false}
                                                                    myself={myself}
                                                                    setMyself={setMyself}
                                                                    showNameAndEmail={true}
                                                                    socket={socket}
                                                                    useUISM={useUISM}
                                                                />
                                                            </ListItemButton>
                                                        ))
                                                    ) : (
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                py: 3,
                                                                color: styles.labelColor,
                                                            }}
                                                        >
                                                            <Typography level="body-sm">
                                                                {fmt(
                                                                    t.admin.projectProfile
                                                                        .noMembersFound,
                                                                    { query: memberSearchQuery }
                                                                )}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Box>
                                            </FormControl>

                                            <Stack direction="row" spacing={4} sx={{ mt: 1 }}>
                                                <FormControl>
                                                    <FormLabel
                                                        sx={{
                                                            color: styles.labelColor,
                                                            fontSize: "0.75rem",
                                                            fontWeight: 600,
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.05em",
                                                            mb: 0.5,
                                                        }}
                                                    >
                                                        Code
                                                    </FormLabel>
                                                    {codeEditMode ? (
                                                        <Stack
                                                            direction="row"
                                                            spacing={0.5}
                                                            alignItems="center"
                                                        >
                                                            <Input
                                                                size="sm"
                                                                value={codeDraft}
                                                                autoFocus
                                                                onChange={(e) =>
                                                                    setCodeDraft(
                                                                        e.target.value.toUpperCase()
                                                                    )
                                                                }
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter")
                                                                        void handleCodeSave();
                                                                    if (e.key === "Escape") {
                                                                        setCodeEditMode(false);
                                                                        setCodeError(null);
                                                                    }
                                                                }}
                                                                slotProps={{
                                                                    input: {
                                                                        maxLength: 6,
                                                                        spellCheck: false,
                                                                        style: {
                                                                            textTransform:
                                                                                "uppercase",
                                                                        },
                                                                    },
                                                                }}
                                                                sx={{
                                                                    width: 90,
                                                                    "--Input-radius": "8px",
                                                                }}
                                                            />
                                                            <Button
                                                                size="sm"
                                                                variant="solid"
                                                                loading={codeSaving}
                                                                onClick={handleCodeSave}
                                                            >
                                                                Save
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="plain"
                                                                color="neutral"
                                                                onClick={() => {
                                                                    setCodeEditMode(false);
                                                                    setCodeError(null);
                                                                }}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </Stack>
                                                    ) : (
                                                        <Stack
                                                            direction="row"
                                                            spacing={0.5}
                                                            alignItems="center"
                                                        >
                                                            <Box
                                                                sx={{
                                                                    display: "inline-flex",
                                                                    px: 1.5,
                                                                    py: 0.5,
                                                                    borderRadius: "8px",
                                                                    background: isDark
                                                                        ? "rgba(124,58,237,0.1)"
                                                                        : "rgba(124,58,237,0.05)",
                                                                    border: `1px solid ${styles.border}`,
                                                                    fontFamily:
                                                                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                                }}
                                                            >
                                                                <Typography
                                                                    fontWeight={600}
                                                                    sx={{
                                                                        color: styles.valueColor,
                                                                    }}
                                                                >
                                                                    {projectProfile?.code || "—"}
                                                                </Typography>
                                                            </Box>
                                                            <AppTooltip
                                                                title="Edit code"
                                                                size="sm"
                                                            >
                                                                <IconButton
                                                                    size="sm"
                                                                    variant="plain"
                                                                    onClick={() => {
                                                                        setCodeDraft(
                                                                            projectProfile?.code ||
                                                                                ""
                                                                        );
                                                                        setCodeError(null);
                                                                        setCodeEditMode(true);
                                                                    }}
                                                                >
                                                                    <EditIcon
                                                                        sx={{ fontSize: 16 }}
                                                                    />
                                                                </IconButton>
                                                            </AppTooltip>
                                                        </Stack>
                                                    )}
                                                    {codeError && (
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{
                                                                color: palette.dangerTint,
                                                                mt: 0.5,
                                                            }}
                                                        >
                                                            {codeError}
                                                        </Typography>
                                                    )}
                                                </FormControl>
                                                <FormControl>
                                                    <FormLabel
                                                        sx={{
                                                            color: styles.labelColor,
                                                            fontSize: "0.75rem",
                                                            fontWeight: 600,
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.05em",
                                                            mb: 0.5,
                                                        }}
                                                    >
                                                        {t.admin.projectProfile.isPrivate}
                                                    </FormLabel>
                                                    <Box
                                                        sx={{
                                                            display: "inline-flex",
                                                            px: 2,
                                                            py: 0.5,
                                                            borderRadius: "20px",
                                                            background: projectProfile?.isPrivate
                                                                ? palette.dangerTintBg
                                                                : palette.successTintBg,
                                                            border: `1px solid ${
                                                                projectProfile?.isPrivate
                                                                    ? palette.dangerTintBorder
                                                                    : palette.successTintBorder
                                                            }`,
                                                        }}
                                                    >
                                                        <Typography
                                                            fontWeight={600}
                                                            sx={{
                                                                userSelect: "text",
                                                                color: projectProfile?.isPrivate
                                                                    ? palette.dangerTint
                                                                    : palette.successTint,
                                                            }}
                                                        >
                                                            {projectProfile?.isPrivate
                                                                ? t.admin.projectProfile.yes
                                                                : t.admin.projectProfile.no}
                                                        </Typography>
                                                    </Box>
                                                </FormControl>

                                                <FormControl>
                                                    <FormLabel
                                                        sx={{
                                                            color: styles.labelColor,
                                                            fontSize: "0.75rem",
                                                            fontWeight: 600,
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.05em",
                                                            mb: 0.5,
                                                        }}
                                                    >
                                                        {t.admin.projectProfile.createdDate}
                                                    </FormLabel>
                                                    <Box
                                                        sx={{
                                                            display: "inline-flex",
                                                            px: 2,
                                                            py: 0.5,
                                                            borderRadius: "8px",
                                                            background: isDark
                                                                ? "rgba(124,58,237,0.1)"
                                                                : "rgba(124,58,237,0.05)",
                                                            border: `1px solid ${styles.border}`,
                                                        }}
                                                    >
                                                        <Typography
                                                            fontWeight={600}
                                                            sx={{
                                                                userSelect: "text",
                                                                color: styles.valueColor,
                                                            }}
                                                        >
                                                            {projectProfile?.tsCreatedAt
                                                                ? extractYYYYMMDD(
                                                                      projectProfile.tsCreatedAt
                                                                  )
                                                                : t.admin.projectProfile
                                                                      .notAvailable}
                                                        </Typography>
                                                    </Box>
                                                </FormControl>
                                            </Stack>

                                            {canShowLeave && (
                                                <Box
                                                    sx={{
                                                        mt: 2,
                                                        display: "flex",
                                                        justifyContent: "flex-end",
                                                    }}
                                                >
                                                    <Button
                                                        color="danger"
                                                        variant="outlined"
                                                        startDecorator={
                                                            <LogoutRoundedIcon fontSize="small" />
                                                        }
                                                        onClick={() => setOpenLeaveConfirm(true)}
                                                        sx={{
                                                            borderRadius: "10px",
                                                            borderColor: "rgba(232,121,195,0.4)",
                                                            color: "rgba(232,121,195,0.9)",
                                                            "&:hover": {
                                                                background:
                                                                    "rgba(232,121,195,0.08)",
                                                                borderColor:
                                                                    "rgba(232,121,195,0.6)",
                                                            },
                                                        }}
                                                    >
                                                        {t.common.actions.leave}
                                                    </Button>
                                                </Box>
                                            )}
                                        </Stack>
                                    </Stack>
                                </Stack>
                            </Card>
                        </Stack>
                    </Box>
                </ModalDialog>
            </Modal>
            <ModalLeaveConfirm
                open={openLeaveConfirm}
                title={t.common.leaveConfirm.projectTitle}
                description={t.common.leaveConfirm.projectDescription}
                entityName={pmChat.chatName}
                onConfirm={handleLeaveProject}
                onCancel={() => setOpenLeaveConfirm(false)}
            />
            <ModalTransferOwner
                open={openTransfer}
                title={t.common.profileEdit.transferTitle}
                description={t.common.profileEdit.transferProjectDescription}
                candidates={transferCandidates}
                onConfirm={handleTransferConfirm}
                onCancel={() => setOpenTransfer(false)}
            />
        </>
    );
};
