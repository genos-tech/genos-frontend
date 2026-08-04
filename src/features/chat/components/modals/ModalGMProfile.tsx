// `sort-keys` is disabled for the file: it carries ~50 violations in
// Joy UI `sx` prop objects whose visual grouping (positioning vs
// sizing vs typography) is intentional and not worth re-sorting given
// the punch-list note above marks the modal as dead code once the v3
// channel-update path replaces these services.
// `simple-import-sort` is disabled because the prettier import-sort
// plugin disagrees with it on react-vs-@mui ordering; prettier wins.

import { useEffect, useMemo, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
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

import { useUserProfile } from "../../../../components/ui/avatars/AvatarContext";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { FileSizeRejectionSnackbar } from "../../../../components/ui/feedback/FileSizeRejectionSnackbar";
import { useFileSizeGuard } from "../../../../components/ui/feedback/useFileSizeGuard";
import { MemberRoleControl } from "../../../../components/ui/memberRoles/MemberRoleControl";
import { ModalLeaveConfirm } from "../../../../components/ui/misc/ModalLeaveConfirm";
import { ModalTransferOwner } from "../../../../components/ui/misc/ModalTransferOwner";
import {
    PROFILE_MODAL_Z_INDEX,
    ProfileModalStyles,
} from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { addMembersToGMWithNotice } from "../../../../services/addMembersWithNotice";
import { channelService } from "../../../../services/channel/channelService";
import { v3ApiBaseURL } from "../../../../services/v3Api";
import { UserProps } from "../../../../types/admin";
import { ChannelKind } from "../../../../types/channel";
import { AllChatProps, GMProfileProps } from "../../../../types/chat";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import {
    bumpGMProfileImageVersion,
    useGMProfileImageVersion,
} from "../../../../utils/gmProfileImageVersion";
import { canManageMembers, MemberRole, resolveMyRole } from "../../../../utils/memberRoles";
import { setGMMemberRole } from "../../services/setGMMemberRole";
import { resolveLegacyChatId } from "../../utils/channelIdResolvers";
import { ExternalSharesPanel } from "./ExternalSharesPanel";
import { ModalAddMembers } from "./ModalAddMembers";

// GM profile-image upload uses the v3 host root (v3ApiBaseURL); the
// legacy VITE_API_BASE_URL (`…/api/v2`) was double-prefixing the v3 path.
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type ModalGMProfileProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    gmChat: AllChatProps;
    openModalGMProfile: boolean;
    setOpenModalGMProfile: (value: boolean) => void;
    setAvatarUserId: (value: string) => void;
    setOpenUserProfile: (value: boolean) => void;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
};

export const ModalGMProfile = (props: ModalGMProfileProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        gmChat,
        openModalGMProfile,
        setOpenModalGMProfile,
        setAvatarUserId,
        setOpenUserProfile,
        useUISM,
        useCM,
    } = props;

    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const styles = isDark ? ProfileModalStyles.dark : ProfileModalStyles.light;

    // Resolve the legacy integer `gm_id` from the v3 channel UUID via
    // `Channel.legacyChatId` (denormalized into the v3 channel list by
    // the Track D ChannelSerializer change). Every legacy GM service
    // this modal calls (`updateGMProfile`, `leaveGM`, `loadGMProfile`,
    // `useGMProfileImageVersion`, `deleteGMChatData`,
    // `bumpGMProfileImageVersion`, the image upload below) binds its
    // backend URL param to a Django `IntegerField` — passing the UUID
    // there yields `ValueError: Field 'gm_id' expected a number`.
    //
    // Returns `-1` when no v3 mirror exists (the backfill hasn't
    // reached this chat). All downstream calls will fail benignly
    // (Django 404) rather than 500-with-traceback; the user sees a
    // clear "load failed" rather than a broken modal.
    const gmChatIdLegacy = resolveLegacyChatId(gmChat.chatId) ?? -1;

    const [gmProfile, setGmProfile] = useState<GMProfileProps | null>(null);

    // The owner, through the resolver rather than out of this team's
    // roster. In a shared chat the owner is usually on the OTHER team, so
    // the roster has never heard of them and the field rendered blank —
    // an unnamed owner with no email, in the section headed "Owner".
    const ownerProfile = useUserProfile(gmProfile?.ownerUserId);
    const ownerName = ownerProfile?.userName || t.chat.modals.gmProfile.na;
    const ownerEmail = ownerProfile?.userEmail || t.chat.modals.gmProfile.na;

    // Pull the current chat row from `useCM.allChats` so the avatar
    // in this modal reflects the freshest profile-image filename
    // after `funcSetAllChats()` runs — the `gmChat` prop is captured
    // by the parent at modal-open time and otherwise goes stale.
    const liveChat = useMemo(() => {
        const found = useCM.allChats.find(
            (c) => c.chatId === gmChat.chatId && c.chatType === gmChat.chatType
        );
        return found ?? gmChat;
    }, [useCM.allChats, gmChat]);

    // Cache-buster shared with GMAvatar (see `gmProfileImageVersion`).
    // Bumped at the end of `handleSelectedFiles` so this modal *and*
    // every mounted GMAvatar refetch the new image even when the
    // backend reuses the filename.
    const imageVersion = useGMProfileImageVersion(gmChat.chatType, gmChatIdLegacy);
    const avatarSrc = liveChat.profileImagePath
        ? `${media_url}/${liveChat.profileImagePath}${imageVersion > 0 ? `?v=${imageVersion}` : ""}`
        : undefined;

    // Leave-GM flow. Owners can't leave (would orphan the group);
    // ownership is loaded async so the button is gated on both
    // gmProfile presence and ownerUserId mismatch.
    const [openLeaveConfirm, setOpenLeaveConfirm] = useState(false);
    const isGMOwner = !!gmProfile && myself.userId === gmProfile.ownerUserId;
    const canShowLeave = !!gmProfile && !isGMOwner;

    // Owner OR editor may manage: rename, image, remove members, and set
    // roles. Only the owner may transfer ownership.
    //
    // `resolveMyRole` overlays `owner` from `ownerUserId`. For GM that
    // also guards against a STALE `"owner"` row: the server maps such a
    // row to viewer, and the FK is what decides here too.
    const myRole = resolveMyRole(myself.userId, gmProfile?.ownerUserId, gmProfile?.gmMembers);
    const canManage = !!gmProfile && canManageMembers(myRole);

    const handleMemberRoleChange = async (
        userId: string,
        nextRole: MemberRole
    ): Promise<boolean> => {
        // No local state patch: `setGMMemberRole` calls `syncChannel`,
        // and this modal re-derives `gmProfile` from the snapshot on
        // every channelService notify — so the roster refreshes itself.
        return setGMMemberRole(gmChat.chatId, userId, nextRole, accessToken);
    };

    // Inline rename + transfer-ownership flow (owner-only). Mirrors
    // ModalTeamProfile and ModalProjectProfile.
    const [nameEditMode, setNameEditMode] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);
    const [nameSaving, setNameSaving] = useState(false);
    const [openTransfer, setOpenTransfer] = useState(false);

    const handleNameSave = async () => {
        if (!gmProfile) return;
        const next = nameDraft.trim();
        if (!next) {
            setNameError(t.common.profileEdit.nameEmpty);
            return;
        }
        if (next === liveChat.chatName) {
            setNameEditMode(false);
            setNameError(null);
            return;
        }
        setNameSaving(true);
        setNameError(null);
        let ok = false;
        try {
            await channelService.updateChannel(gmChat.chatId, ChannelKind.GM, { title: next });
            ok = true;
        } catch (e) {
            console.error("[ModalGMProfile] rename failed:", e);
            setNameError("Failed to rename the group.");
        }
        setNameSaving(false);
        if (ok) {
            // The v3 `channel.updated` broadcast updates
            // `snapshot.channels`, which the `funcSetAllChats`
            // subscription re-derives into `allChats`. The optimistic
            // local patch below avoids the one-frame flicker between
            // the emit ack and the broadcast landing.
            useCM.setAllChats((prev) =>
                prev.map((c) =>
                    c.chatType === gmChat.chatType && c.chatId === gmChat.chatId
                        ? { ...c, chatName: next }
                        : c
                )
            );
            setNameEditMode(false);
        }
    };

    const handleTransferConfirm = async (newOwnerId: string) => {
        if (!gmProfile) return false;
        try {
            await channelService.updateChannel(gmChat.chatId, ChannelKind.GM, {
                ownerUserId: newOwnerId,
            });
        } catch (e) {
            console.error("[ModalGMProfile] owner transfer failed:", e);
            return false;
        }
        setGmProfile({ ...gmProfile, ownerUserId: newOwnerId });
        setOpenTransfer(false);
        return true;
    };

    const transferCandidates = useMemo(
        () =>
            (gmProfile?.gmMembers ?? [])
                .filter((m) => m.userId !== myself.userId)
                .map((m) => ({
                    userId: m.userId,
                    userName: m.userName,
                    userEmail: m.userEmail,
                    avatarImgPath: m.avatarImgPath,
                })),
        [gmProfile?.gmMembers, myself.userId]
    );

    // Add-teammates flow. Open to ANY GM member, not just the owner
    // (unlike rename / transfer above) — that was the ask, and the v3
    // members endpoint authorises on membership, not ownership.
    //
    // No local roster patch: the v3 `channel.member.add` broadcast updates
    // `snapshot.membersByChannel`, and this modal derives `gmProfile` from
    // that snapshot via a `channelService.subscribe` — so the member list
    // refreshes itself.
    const [openAddMembers, setOpenAddMembers] = useState(false);

    const handleAddMembers = async (memberIds: string[]): Promise<boolean> => {
        const { failedIds } = await addMembersToGMWithNotice({
            channelId: gmChat.chatId,
            gmName: liveChat.chatName,
            memberIds,
            socket,
        });
        return failedIds.length === 0;
    };

    const handleLeaveGM = async () => {
        // v3 leave. `channelService.removeMember` posts to the v3
        // backend, which broadcasts `channel.member_removed` to every
        // member (including us). The handler in channelService evicts
        // the channel from `snapshot.channels` for the leaver, which
        // cascades through the `funcSetAllChats` subscription and the
        // `currentMainChat` / `currentSubChat` subscriptions in
        // useChatManagement — no manual local-state cleanup needed.
        try {
            await channelService.removeMember(gmChat.chatId, ChannelKind.GM, myself.userId);
        } catch (error) {
            console.error("[ModalGMProfile] leave GM failed:", error);
            return false;
        }
        setOpenModalGMProfile(false);
        return true;
    };

    // Member search state
    const [memberSearchQuery, setMemberSearchQuery] = useState("");

    // Filter members based on search query
    const filteredMembers = useMemo(() => {
        if (!gmProfile?.gmMembers) return [];
        if (!memberSearchQuery.trim()) {
            return gmProfile.gmMembers;
        }
        const query = memberSearchQuery.toLowerCase();
        return gmProfile.gmMembers.filter(
            (member) =>
                member.userName.toLowerCase().includes(query) ||
                member.userEmail.toLowerCase().includes(query)
        );
    }, [gmProfile?.gmMembers, memberSearchQuery]);

    // Profile image file upload manager
    const inputRef = useRef<HTMLInputElement | null>(null);
    const handleButtonClick = () => {
        inputRef.current?.click();
    };

    // Per-file size cap. Profile images are tiny by nature; the cap is
    // mostly a safety net against accidentally selecting a 4K RAW.
    const { rejection, dismissRejection, filterFiles } = useFileSizeGuard();

    const handleSelectedFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (!selectedFiles || selectedFiles.length !== 1) return;

        const accepted = filterFiles(selectedFiles);
        if (accepted.length === 0) {
            event.target.value = "";
            return;
        }

        const tmpGMProfileImage = accepted[0];
        const imageFileName = "profile.jpg";
        const userProfileImage = new File([tmpGMProfileImage], imageFileName, {
            type: tmpGMProfileImage.type,
            lastModified: tmpGMProfileImage.lastModified,
        });

        const formData = new FormData();
        formData.append("profile_image", userProfileImage);
        // v3 endpoint. Channel UUID lives in the URL — no `gm_id`
        // body field needed. The view writes the binary via
        // `Channel.profile_image_file` (FileField), then sets
        // `Channel.profile_image_url` to the resolved storage path so
        // the response body's `profileImageUrl` is the URL the FE
        // should display next.
        const uploadProfileImageResponse = await fetch(
            `${v3ApiBaseURL()}/api/v3/channels/${gmChat.chatId}/profile/image/`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: formData,
            }
        );

        if (!uploadProfileImageResponse.ok) {
            throw new Error(t.chat.modals.gmProfile.uploadImageError);
        }

        // The v3 REST endpoint doesn't fan out a socket broadcast (the
        // legacy endpoint didn't either). For this tab, hit
        // `syncChannel` so `snapshot.channels` picks up the new
        // `profile_image_url`; the `funcSetAllChats` subscription then
        // re-derives `allChats`. Other tabs see the new image on their
        // next `listChannels` / `syncChannel` poll — an acceptable
        // gap that matches the legacy behavior.
        await channelService.syncChannel(gmChat.chatId);
        await useCM.funcSetAllChats();
        // Bump the per-chat image version so this modal and every
        // mounted GMAvatar refetch with a fresh `?v=N` query string —
        // covers the case where the backend wrote the new bytes under
        // the same filename.
        bumpGMProfileImageVersion(gmChat.chatType, gmChatIdLegacy);
    };

    // v3 source. Derive `GMProfileProps` from `channelService.snapshot`
    // and re-derive on every channelService notify so the owner badge,
    // member roster, and rename input stay live as broadcasts land.
    useEffect(() => {
        if (!openModalGMProfile) return;
        setMemberSearchQuery("");
        let lastChannelRef: unknown;
        let lastMembersRef: unknown;
        const apply = () => {
            const snapshot = channelService.getSnapshot();
            const channel = snapshot.channels.get(gmChat.chatId);
            const members = snapshot.membersByChannel.get(gmChat.chatId);
            if (channel === lastChannelRef && members === lastMembersRef) return;
            lastChannelRef = channel;
            lastMembersRef = members;
            if (!channel) {
                setGmProfile(null);
                return;
            }
            // This map rebuilds each member field-by-field, so anything
            // not listed here is dropped on the floor — `memberRole` has
            // to be carried explicitly or every member renders as a
            // viewer forever. (`memberRole?` is optional on UserProps,
            // so TypeScript would not catch the omission.)
            const gmMembers = (members ?? []).map((m) => ({
                userId: m.userId,
                userName: m.user?.userName ?? "",
                userEmail: m.user?.userEmail ?? "",
                avatarImgPath: m.user?.avatarImgPath ?? "",
                memberRole: m.memberRole,
                teamId: myself.teamId,
                teamName: myself.teamName,
                tsLastSeen: "",
                tsJoined: m.tsJoined ?? "",
            }));
            setGmProfile({
                gmId: channel.legacyChatId ?? 0,
                gmName: channel.title || "",
                ownerUserId: channel.ownerId ?? "",
                profileImagePath: channel.profileImageUrl || "",
                gmMembers,
                isPrivate: channel.isPrivate,
                isExternal: channel.isExternal,
                tsCreatedAt: channel.tsCreated || "",
            });
        };
        apply();
        const unsubscribe = channelService.subscribe(apply);
        return unsubscribe;
        // gmChat.chatId is stable per open; `myself` only matters for
        // the teamId/teamName fields that the legacy gmMembers shape
        // demanded — re-arm if the team changes.
    }, [openModalGMProfile, gmChat.chatId, myself.teamId, myself.teamName]);

    return (
        <>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
            <Modal
                open={openModalGMProfile}
                sx={{
                    zIndex: PROFILE_MODAL_Z_INDEX,
                    backdropFilter: "blur(8px)",
                    backgroundColor: "transparent",
                }}
                onClose={() => setOpenModalGMProfile(false)}
            >
                <ModalDialog
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    sx={{
                        background: styles.bg,
                        border: `1px solid ${styles.border}`,
                        boxShadow: styles.shadow,
                        borderRadius: { xs: "0", md: "20px" },
                        overflow: "auto",
                        transition: "all 0.3s ease",
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
                        {/* Header */}
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
                                    Group Message Profile - {liveChat.chatName}
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
                                        : "0 4px 20px rgba(var(--gp-brand-700-rgb), 0.08)",
                                    transition: "all 0.3s ease",
                                    "&:hover": {
                                        boxShadow: isDark
                                            ? "0 8px 30px rgba(0,0,0,0.4)"
                                            : "0 8px 30px rgba(var(--gp-brand-700-rgb), 0.12)",
                                    },
                                }}
                            >
                                <Stack
                                    direction="row"
                                    sx={{ display: { xs: "none", md: "flex" }, my: 1 }}
                                >
                                    {/* Avatar Section */}
                                    <Box
                                        sx={{
                                            pl: "20px",
                                            pr: "40px",
                                            position: "relative",
                                            display: "inline-block",
                                        }}
                                    >
                                        <Avatar
                                            src={avatarSrc}
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
                                                        ? "0 0 50px rgba(var(--gp-brand-700-rgb), 0.5), 0 0 100px rgba(var(--gp-brand-500-rgb), 0.3)"
                                                        : "0 0 50px rgba(var(--gp-brand-700-rgb), 0.3), 0 0 100px rgba(var(--gp-brand-500-rgb), 0.15)",
                                                },
                                            }}
                                        >
                                            <GroupsRoundedIcon sx={{ fontSize: 100 }} />
                                        </Avatar>

                                        {/* Edit Button — owner/editor only, matching
                                            the backend gate on the v3 channel image
                                            endpoint. Previously shown to everyone. */}
                                        {canManage && (
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
                                                    variant="outlined"
                                                    title={
                                                        t.chat.modals.gmProfile
                                                            .editProfileImageTooltip
                                                    }
                                                >
                                                    <IconButton
                                                        variant="soft"
                                                        sx={{
                                                            background: isDark
                                                                ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.3) 0%, rgba(var(--gp-brand-500-rgb), 0.3) 100%)"
                                                                : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.15) 0%, rgba(var(--gp-brand-500-rgb), 0.15) 100%)",
                                                            border: `1px solid ${styles.border}`,
                                                            transition: "all 0.2s ease",
                                                            "&:hover": {
                                                                background: isDark
                                                                    ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.5) 0%, rgba(var(--gp-brand-500-rgb), 0.5) 100%)"
                                                                    : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.25) 0%, rgba(var(--gp-brand-500-rgb), 0.25) 100%)",
                                                                transform: "scale(1.1)",
                                                            },
                                                        }}
                                                        onClick={handleButtonClick}
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
                                        )}
                                    </Box>

                                    {/* Details Section */}
                                    <Stack spacing={2} sx={{ flexGrow: 1 }}>
                                        <Stack direction="column" spacing={1.5}>
                                            {/* Group name — inline rename for owners. */}
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
                                                    Group name
                                                </FormLabel>
                                                {nameEditMode ? (
                                                    <Stack
                                                        alignItems="center"
                                                        direction="row"
                                                        spacing={1}
                                                    >
                                                        <Input
                                                            size="sm"
                                                            value={nameDraft}
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
                                                            // Pin keydown to the inner <input>
                                                            // so Enter/Escape never get
                                                            // swallowed by Joy's slot wrapper.
                                                            sx={{
                                                                flex: 1,
                                                                "--Input-radius": "8px",
                                                            }}
                                                            autoFocus
                                                            onChange={(e) =>
                                                                setNameDraft(e.target.value)
                                                            }
                                                        />
                                                        <Button
                                                            loading={nameSaving}
                                                            size="sm"
                                                            variant="solid"
                                                            onClick={handleNameSave}
                                                        >
                                                            {t.common.profileEdit.save}
                                                        </Button>
                                                        <Button
                                                            color="neutral"
                                                            size="sm"
                                                            variant="plain"
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
                                                        alignItems="center"
                                                        direction="row"
                                                        spacing={1}
                                                    >
                                                        <Typography
                                                            fontWeight="bold"
                                                            sx={{
                                                                userSelect: "text",
                                                                color: styles.valueColor,
                                                                fontSize: "18px",
                                                            }}
                                                        >
                                                            {liveChat.chatName}
                                                        </Typography>
                                                        {canManage && (
                                                            <Tooltip
                                                                size="sm"
                                                                title={t.common.profileEdit.rename}
                                                                variant="outlined"
                                                            >
                                                                <IconButton
                                                                    size="sm"
                                                                    variant="plain"
                                                                    onClick={() => {
                                                                        setNameDraft(
                                                                            liveChat.chatName
                                                                        );
                                                                        setNameError(null);
                                                                        setNameEditMode(true);
                                                                    }}
                                                                >
                                                                    <EditIcon
                                                                        sx={{ fontSize: 16 }}
                                                                    />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Stack>
                                                )}
                                                {nameError && (
                                                    <Typography
                                                        level="body-xs"
                                                        sx={{
                                                            color: "rgba(var(--gp-tint-danger-rgb), 0.9)",
                                                            mt: 0.5,
                                                        }}
                                                    >
                                                        {nameError}
                                                    </Typography>
                                                )}
                                            </FormControl>

                                            {/* Owner */}
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
                                                    {t.chat.modals.gmProfile.owner}
                                                </FormLabel>
                                                {/* Name + email on one (wrap-friendly) row,
                                                    Transfer button on its own row below. */}
                                                <Stack
                                                    alignItems="center"
                                                    direction="row"
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
                                                            if (gmProfile?.ownerUserId) {
                                                                setAvatarUserId(
                                                                    gmProfile.ownerUserId
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
                                                            {ownerName}
                                                        </Typography>
                                                    </Button>
                                                    <Typography
                                                        component="a"
                                                        href={`mailto:${ownerEmail}`}
                                                        startDecorator={
                                                            <EmailRoundedIcon
                                                                fontSize="small"
                                                                sx={{ color: styles.accentColor }}
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
                                                        {ownerEmail}
                                                    </Typography>
                                                </Stack>
                                                {isGMOwner && (
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            justifyContent: "flex-end",
                                                            mt: 1,
                                                            mb: 1.5,
                                                        }}
                                                    >
                                                        <Button
                                                            color="neutral"
                                                            size="sm"
                                                            sx={{ borderRadius: "8px" }}
                                                            variant="outlined"
                                                            startDecorator={
                                                                <SwapHorizRoundedIcon
                                                                    sx={{ fontSize: 16 }}
                                                                />
                                                            }
                                                            onClick={() => setOpenTransfer(true)}
                                                        >
                                                            {t.common.profileEdit.transferOwner}
                                                        </Button>
                                                    </Box>
                                                )}
                                            </FormControl>

                                            {/* Members with Search.
                                                The list is a SIBLING of the FormControl, not a
                                                child: Joy allows only one control component per
                                                FormControl, and the list now holds a role
                                                <Select> per row — with the search <Input> that
                                                was two controls in one instance. */}
                                            <Box sx={{ display: "flex", flexDirection: "column" }}>
                                                <FormControl>
                                                    <Stack
                                                        alignItems="center"
                                                        direction="row"
                                                        justifyContent="space-between"
                                                        sx={{ mb: 1 }}
                                                    >
                                                        <Stack
                                                            alignItems="center"
                                                            direction="row"
                                                            spacing={1}
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
                                                                {fmt(
                                                                    t.chat.modals.gmProfile
                                                                        .membersCount,
                                                                    {
                                                                        filtered:
                                                                            filteredMembers.length,
                                                                        total:
                                                                            gmProfile?.gmMembers
                                                                                ?.length || 0,
                                                                    }
                                                                )}
                                                            </FormLabel>
                                                            {/* Any member can add teammates — no
                                                            owner gate. */}
                                                            <Button
                                                                disabled={!gmProfile}
                                                                size="sm"
                                                                variant="soft"
                                                                startDecorator={
                                                                    <PersonAddAltRoundedIcon
                                                                        sx={{ fontSize: 14 }}
                                                                    />
                                                                }
                                                                sx={{
                                                                    borderRadius: "8px",
                                                                    fontSize: "12px",
                                                                    fontWeight: 600,
                                                                    flexShrink: 0,
                                                                }}
                                                                onClick={() =>
                                                                    setOpenAddMembers(true)
                                                                }
                                                            >
                                                                {t.common.addMembers.openButton}
                                                            </Button>
                                                        </Stack>
                                                        <Input
                                                            value={memberSearchQuery}
                                                            endDecorator={
                                                                memberSearchQuery && (
                                                                    <IconButton
                                                                        size="sm"
                                                                        variant="plain"
                                                                        sx={{
                                                                            minWidth: "24px",
                                                                            minHeight: "24px",
                                                                            borderRadius: "50%",
                                                                        }}
                                                                        onClick={() =>
                                                                            setMemberSearchQuery(
                                                                                ""
                                                                            )
                                                                        }
                                                                    >
                                                                        <CloseIcon
                                                                            sx={{
                                                                                fontSize: "16px",
                                                                            }}
                                                                        />
                                                                    </IconButton>
                                                                )
                                                            }
                                                            placeholder={
                                                                t.chat.modals.gmProfile
                                                                    .searchMembersPlaceholder
                                                            }
                                                            startDecorator={
                                                                <SearchIcon
                                                                    sx={{
                                                                        color: styles.accentColor,
                                                                        fontSize: "18px",
                                                                    }}
                                                                />
                                                            }
                                                            sx={{
                                                                width: "220px",
                                                                "--Input-focusedThickness": "1px",
                                                                "--Input-radius": "8px",
                                                                background: styles.inputBg,
                                                                border: `1px solid ${styles.border}`,
                                                                fontSize: "14px",
                                                                transition: "all 0.2s ease",
                                                                "&:hover": {
                                                                    borderColor:
                                                                        styles.accentColor,
                                                                },
                                                                "&:focus-within": {
                                                                    borderColor:
                                                                        styles.accentColor,
                                                                    boxShadow: isDark
                                                                        ? "0 0 0 2px rgba(var(--gp-brand-700-rgb), 0.2)"
                                                                        : "0 0 0 2px rgba(var(--gp-brand-700-rgb), 0.1)",
                                                                },
                                                            }}
                                                            onChange={(e) =>
                                                                setMemberSearchQuery(
                                                                    e.target.value
                                                                )
                                                            }
                                                        />
                                                    </Stack>
                                                </FormControl>
                                                <Box
                                                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                                                    sx={{
                                                        maxHeight: "300px",
                                                        overflow: "auto",
                                                        background: isDark
                                                            ? "rgba(0,0,0,0.2)"
                                                            : "rgba(var(--gp-brand-700-rgb), 0.03)",
                                                        borderRadius: "12px",
                                                        border: `1px solid ${styles.border}`,
                                                        p: 1,
                                                    }}
                                                >
                                                    {filteredMembers.length > 0 ? (
                                                        filteredMembers.map((member) => (
                                                            <ListItemButton
                                                                key={`gm-member-${member.userId}`}
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
                                                                    isYou={false}
                                                                    myself={myself}
                                                                    setMyself={setMyself}
                                                                    showNameAndEmail={true}
                                                                    socket={socket}
                                                                    useCM={useCM}
                                                                    useUISM={useUISM}
                                                                />
                                                                <Box sx={{ ml: "auto", pl: 1 }}>
                                                                    <MemberRoleControl
                                                                        canManage={canManage}
                                                                        userId={member.userId}
                                                                        isSelf={
                                                                            member.userId ===
                                                                            myself.userId
                                                                        }
                                                                        memberRole={
                                                                            member.memberRole
                                                                        }
                                                                        ownerUserId={
                                                                            gmProfile?.ownerUserId
                                                                        }
                                                                        popupZIndex={
                                                                            PROFILE_MODAL_Z_INDEX +
                                                                            2
                                                                        }
                                                                        onChange={
                                                                            handleMemberRoleChange
                                                                        }
                                                                    />
                                                                </Box>
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
                                                                    t.chat.modals.gmProfile
                                                                        .noMembersFound,
                                                                    { query: memberSearchQuery }
                                                                )}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Box>
                                            </Box>

                                            {/* Is Private & Created Date */}
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
                                                        {t.chat.modals.gmProfile.isPrivate}
                                                    </FormLabel>
                                                    <Box
                                                        sx={{
                                                            display: "inline-flex",
                                                            px: 2,
                                                            py: 0.5,
                                                            borderRadius: "20px",
                                                            background: gmProfile?.isPrivate
                                                                ? isDark
                                                                    ? "linear-gradient(135deg, rgba(var(--gp-tint-danger-rgb), 0.2) 0%, rgba(var(--gp-tint-danger-alt-rgb), 0.2) 100%)"
                                                                    : "linear-gradient(135deg, rgba(var(--gp-tint-danger-rgb), 0.15) 0%, rgba(var(--gp-tint-danger-alt-rgb), 0.15) 100%)"
                                                                : isDark
                                                                  ? "linear-gradient(135deg, rgba(var(--gp-brand-400-rgb), 0.2) 0%, rgba(var(--gp-brand-500-rgb), 0.2) 100%)"
                                                                  : "linear-gradient(135deg, rgba(var(--gp-brand-600-rgb), 0.12) 0%, rgba(var(--gp-brand-800-rgb), 0.12) 100%)",
                                                            border: `1px solid ${
                                                                gmProfile?.isPrivate
                                                                    ? "rgba(var(--gp-tint-danger-rgb), 0.3)"
                                                                    : "rgba(var(--gp-brand-400-rgb), 0.3)"
                                                            }`,
                                                        }}
                                                    >
                                                        <Typography
                                                            fontWeight={600}
                                                            sx={{
                                                                userSelect: "text",
                                                                color: gmProfile?.isPrivate
                                                                    ? isDark
                                                                        ? "var(--gp-tint-danger)"
                                                                        : "var(--gp-tint-danger-alt)"
                                                                    : isDark
                                                                      ? "var(--gp-brand-400)"
                                                                      : "var(--gp-brand-600)",
                                                            }}
                                                        >
                                                            {gmProfile?.isPrivate
                                                                ? t.chat.modals.gmProfile.yes
                                                                : t.chat.modals.gmProfile.no}
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
                                                        {t.chat.modals.gmProfile.createdDate}
                                                    </FormLabel>
                                                    <Box
                                                        sx={{
                                                            display: "inline-flex",
                                                            px: 2,
                                                            py: 0.5,
                                                            borderRadius: "8px",
                                                            background: isDark
                                                                ? "rgba(var(--gp-brand-700-rgb), 0.1)"
                                                                : "rgba(var(--gp-brand-700-rgb), 0.05)",
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
                                                            {gmProfile?.tsCreatedAt
                                                                ? extractYYYYMMDD(
                                                                      gmProfile.tsCreatedAt
                                                                  )
                                                                : t.chat.modals.gmProfile.na}
                                                        </Typography>
                                                    </Box>
                                                </FormControl>
                                            </Stack>

                                            {gmProfile?.isExternal && (
                                                <ExternalSharesPanel
                                                    borderColor={styles.border}
                                                    channelId={gmChat.chatId}
                                                    labelColor={styles.labelColor}
                                                    myUserId={myself.userId}
                                                    valueColor={styles.valueColor}
                                                />
                                            )}

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
                                                        sx={{
                                                            borderRadius: "10px",
                                                            borderColor:
                                                                "rgba(var(--gp-tint-danger-rgb), 0.4)",
                                                            color: "rgba(var(--gp-tint-danger-rgb), 0.9)",
                                                            "&:hover": {
                                                                background:
                                                                    "rgba(var(--gp-tint-danger-rgb), 0.08)",
                                                                borderColor:
                                                                    "rgba(var(--gp-tint-danger-rgb), 0.6)",
                                                            },
                                                        }}
                                                        onClick={() => setOpenLeaveConfirm(true)}
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
                description={t.common.leaveConfirm.gmDescription}
                entityName={gmChat.chatName}
                open={openLeaveConfirm}
                title={t.common.leaveConfirm.gmTitle}
                onCancel={() => setOpenLeaveConfirm(false)}
                onConfirm={handleLeaveGM}
            />
            <ModalTransferOwner
                candidates={transferCandidates}
                description={t.common.profileEdit.transferGMDescription}
                open={openTransfer}
                title={t.common.profileEdit.transferTitle}
                onCancel={() => setOpenTransfer(false)}
                onConfirm={handleTransferConfirm}
            />
            {/* `onAdd` overrides the picker's DM→MDM dispatch;
                `excludeUserIds` hides current members (the picker can't
                derive a GM roster from `AllChatProps`). */}
            <ModalAddMembers
                chat={gmChat}
                excludeUserIds={(gmProfile?.gmMembers ?? []).map((m) => m.userId)}
                heading={fmt(t.common.addMembers.headingGM, { gmName: liveChat.chatName })}
                myself={myself}
                open={openAddMembers}
                setMyself={setMyself}
                setOpen={setOpenAddMembers}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
                // Derived from this modal's own layer, not hardcoded — the
                // picker's page-level default (10000) is BELOW us and would
                // open behind the modal that launched it.
                zIndex={PROFILE_MODAL_Z_INDEX + 1}
                onAdd={handleAddMembers}
            />
        </>
    );
};
