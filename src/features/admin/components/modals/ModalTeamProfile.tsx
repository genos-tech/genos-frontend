import { useMemo, useRef, useState } from "react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
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
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

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
import { TeamProfileProps, UserProps } from "../../../../types/admin";
import { buildAvatarSrc } from "../../../../utils/avatarSrc";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { canManageMembers, MemberRole, resolveMyRole } from "../../../../utils/memberRoles";
import { leaveTeam } from "../../services/leaveTeam";
import { setTeamMemberRole } from "../../services/setTeamMemberRole";
import { updateTeamProfile } from "../../services/updateTeamProfile";
import { ModalInviteMembers } from "./ModalInviteMembers";

const base_url = import.meta.env.VITE_API_BASE_URL;

type ModalTeamProfileProps = {
    socket: Socket | null;
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    teamProfile: TeamProfileProps;
    setTeamProfile: (value: TeamProfileProps | null) => void;
    openModalTeamProfile: boolean;
    setOpenModalTeamProfile: (value: boolean) => void;
    setAvatarUserId: (value: string) => void;
    setOpenUserProfile: (value: boolean) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};
export const ModalTeamProfile = (props: ModalTeamProfileProps) => {
    const {
        socket,
        useTEM,
        myself,
        setMyself,
        teamProfile,
        setTeamProfile,
        openModalTeamProfile,
        setOpenModalTeamProfile,
        setAvatarUserId,
        setOpenUserProfile,
        useCM,
        useUISM,
    } = props;

    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isDark = mode === "dark";
    const styles = isDark ? ProfileModalStyles.dark : ProfileModalStyles.light;

    // Member search state
    const [memberSearchQuery, setMemberSearchQuery] = useState("");

    // Leave-team flow. Owners can't leave (would orphan the team), so
    // the button is hidden when myself === teamOwnerId. After a
    // successful leave we drop the team-scoped localStorage keys and
    // route to /jointeam — same shape as the post-signup landing page,
    // which lists the user's remaining teams plus create/join forms.
    const [openLeaveConfirm, setOpenLeaveConfirm] = useState(false);
    const isTeamOwner = myself.userId === teamProfile.teamOwnerId;

    // Owner OR editor may manage: invite, rename, change the image, and
    // set other members' roles. Only the owner may transfer ownership.
    //
    // `resolveMyRole` overlays `owner` from `teamOwnerId` — the server
    // never stores "owner" on a member row, so reading `memberRole`
    // directly here would deny the actual owner.
    const myRole = resolveMyRole(myself.userId, teamProfile.teamOwnerId, teamProfile.teamMembers);
    const canManage = canManageMembers(myRole);

    // Role edits are written straight to the server; mirror the result
    // into `teamProfile` so the chip/picker re-renders without refetching
    // the whole team.
    const handleMemberRoleChange = async (
        userId: string,
        nextRole: MemberRole
    ): Promise<boolean> => {
        const ok = await setTeamMemberRole(teamProfile.teamId, userId, nextRole, accessToken);
        if (!ok) return false;
        setTeamProfile({
            ...teamProfile,
            teamMembers: teamProfile.teamMembers.map((m) =>
                String(m.userId) === String(userId) ? { ...m, memberRole: nextRole } : m
            ),
        });
        return true;
    };

    // Inline rename + transfer-ownership flow (owner-only). Both PUT
    // through the same endpoint (`updateTeamProfile`). Renames update
    // the local `teamProfile` so the modal reflects the change without
    // a refetch; the per-user my_teams cache (60s TTL) refreshes on
    // its own.
    const [nameEditMode, setNameEditMode] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);
    const [nameSaving, setNameSaving] = useState(false);
    const [openTransfer, setOpenTransfer] = useState(false);

    // Invite-by-email flow (owner-only). The button + sub-modal are gated
    // by isTeamOwner; the backend re-checks ownership on /team/invite/.
    const [openInvite, setOpenInvite] = useState(false);

    const handleNameSave = async () => {
        const next = nameDraft.trim();
        if (!next) {
            setNameError(t.common.profileEdit.nameEmpty);
            return;
        }
        if (next === teamProfile.teamName) {
            setNameEditMode(false);
            setNameError(null);
            return;
        }
        setNameSaving(true);
        setNameError(null);
        const ok = await updateTeamProfile(
            accessToken,
            teamProfile.teamId,
            { teamName: next },
            setNameError
        );
        setNameSaving(false);
        if (ok) {
            setTeamProfile({ ...teamProfile, teamName: next });
            setNameEditMode(false);
        }
    };

    const handleTransferConfirm = async (newOwnerId: string) => {
        const ok = await updateTeamProfile(accessToken, teamProfile.teamId, {
            ownerId: newOwnerId,
        });
        if (ok) {
            setTeamProfile({ ...teamProfile, teamOwnerId: newOwnerId });
            setOpenTransfer(false);
        }
        return ok;
    };

    // Members the owner can transfer ownership to: everyone except
    // themselves. Empty when the team has only the owner.
    const transferCandidates = useMemo(
        () =>
            teamProfile.teamMembers
                .filter((m) => m.userId !== myself.userId)
                .map((m) => ({
                    userId: m.userId,
                    userName: m.userName,
                    userEmail: m.userEmail,
                    avatarImgPath: m.avatarImgPath,
                })),
        [teamProfile.teamMembers, myself.userId]
    );

    const handleLeaveTeam = async () => {
        const ok = await leaveTeam(accessToken, teamProfile.teamId, myself.userId);
        if (!ok) return false;
        // The /jointeam screen reads teamId/teamName fresh and the
        // workspace bootstrap re-fetches on team change, so clearing
        // these two keys is enough to force a clean re-entry.
        localStorage.removeItem("teamId");
        localStorage.removeItem("teamName");
        setOpenModalTeamProfile(false);
        navigate("/jointeam");
        return true;
    };

    // Filter members based on search query
    const filteredMembers = useMemo(() => {
        if (!memberSearchQuery.trim()) {
            return teamProfile.teamMembers;
        }
        const query = memberSearchQuery.toLowerCase();
        return teamProfile.teamMembers.filter(
            (member) =>
                member.userName.toLowerCase().includes(query) ||
                member.userEmail.toLowerCase().includes(query)
        );
    }, [teamProfile.teamMembers, memberSearchQuery]);

    // Profile image file upload manager
    const inputRef = useRef<HTMLInputElement | null>(null);
    const handleButtonClick = () => {
        inputRef.current?.click();
    };

    // Per-file size cap. Profile images are tiny by nature; the cap is
    // mostly a safety net against accidentally selecting a 4K RAW.
    const { rejection, dismissRejection, filterFiles } = useFileSizeGuard();

    const handleSelectedFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (myself.teamId) {
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
            formData.append("team_profile_image", userProfileImage);
            formData.append("team_id", myself.teamId);
            const uploadProfileImageResponse = await fetch(`${base_url}/team/profile/image/`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: formData,
            });

            const uploadProfileImageData = await uploadProfileImageResponse.json();

            if (!uploadProfileImageResponse.ok) {
                throw new Error(t.admin.teamProfile.uploadFailed);
            } else {
                localStorage.setItem(
                    "teamImgPath",
                    uploadProfileImageData.profile_image_file_name
                );
                useTEM.setCurrentTeam({
                    ...useTEM.currentTeam,
                    teamImgPath: uploadProfileImageData.profile_image_file_name,
                });
                setTeamProfile({
                    ...teamProfile,
                    teamImgPath: uploadProfileImageData.profile_image_file_name,
                });
            }
        }
    };

    return (
        <>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
            <Modal
                open={openModalTeamProfile}
                sx={{
                    zIndex: 10001,
                    backdropFilter: "blur(8px)",
                    backgroundColor: "transparent",
                }}
                onClose={() => setOpenModalTeamProfile(false)}
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
                                    {fmt(t.admin.teamProfile.title, {
                                        teamName: teamProfile.teamName,
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
                                    alignItems={{ xs: "stretch", md: "flex-start" }}
                                    direction={{ xs: "column", md: "row" }}
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
                                            src={buildAvatarSrc(teamProfile.teamImgPath)}
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
                                                    title={t.admin.teamProfile.editTeamImage}
                                                    variant="outlined"
                                                >
                                                    <IconButton
                                                        variant="soft"
                                                        sx={{
                                                            background: isDark
                                                                ? "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(139,92,246,0.12) 100%)"
                                                                : "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(139,92,246,0.08) 100%)",
                                                            border: `1px solid ${styles.border}`,
                                                            transition: "all 0.2s ease",
                                                            "&:hover": {
                                                                background: isDark
                                                                    ? "linear-gradient(135deg, rgba(139,92,246,0.5) 0%, rgba(139,92,246,0.5) 100%)"
                                                                    : "linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0.25) 100%)",
                                                                transform: "scale(1.1)",
                                                            },
                                                        }}
                                                        onClick={() => {
                                                            handleButtonClick();
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
                                        )}
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
                                            <Stack direction="row" spacing={4}>
                                                <FormControl sx={{ flex: 1 }}>
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
                                                        {t.admin.teamProfile.teamName}
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
                                                                            if (
                                                                                e.key === "Enter"
                                                                            ) {
                                                                                e.preventDefault();
                                                                                void handleNameSave();
                                                                            }
                                                                            if (
                                                                                e.key === "Escape"
                                                                            ) {
                                                                                setNameEditMode(
                                                                                    false
                                                                                );
                                                                                setNameError(null);
                                                                            }
                                                                        },
                                                                    },
                                                                }}
                                                                onChange={(e) =>
                                                                    setNameDraft(e.target.value)
                                                                }
                                                                // Pin keydown to the inner <input>
                                                                // via slotProps so Enter/Escape
                                                                // always land on the typing
                                                                // target — Joy Input's outer
                                                                // onKeyDown wrapper can miss
                                                                // synthetic events that bubble
                                                                // through composed slots.
                                                                sx={{
                                                                    flex: 1,
                                                                    "--Input-radius": "8px",
                                                                }}
                                                                autoFocus
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
                                                            <Box
                                                                sx={{
                                                                    flex: 1,
                                                                    px: 2,
                                                                    py: 1,
                                                                    borderRadius: "8px",
                                                                    background: isDark
                                                                        ? "rgba(124,58,237,0.1)"
                                                                        : "rgba(124,58,237,0.05)",
                                                                    border: `1px solid ${styles.border}`,
                                                                }}
                                                            >
                                                                <Typography
                                                                    fontWeight="bold"
                                                                    sx={{
                                                                        userSelect: "text",
                                                                        color: styles.valueColor,
                                                                        fontSize: "18px",
                                                                    }}
                                                                >
                                                                    {teamProfile.teamName}
                                                                </Typography>
                                                            </Box>
                                                            {canManage && (
                                                                <Tooltip
                                                                    size="sm"
                                                                    variant="outlined"
                                                                    title={
                                                                        t.common.profileEdit.rename
                                                                    }
                                                                >
                                                                    <IconButton
                                                                        size="sm"
                                                                        variant="plain"
                                                                        onClick={() => {
                                                                            setNameDraft(
                                                                                teamProfile.teamName
                                                                            );
                                                                            setNameError(null);
                                                                            setNameEditMode(true);
                                                                        }}
                                                                    >
                                                                        <EditIcon
                                                                            sx={{ fontSize: 18 }}
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
                                                                color: "rgba(232,121,195,0.9)",
                                                                mt: 0.5,
                                                            }}
                                                        >
                                                            {nameError}
                                                        </Typography>
                                                    )}
                                                </FormControl>
                                            </Stack>

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
                                                    {t.admin.teamProfile.teamId}
                                                </FormLabel>
                                                <Box
                                                    sx={{
                                                        display: "inline-flex",
                                                        px: 2,
                                                        py: 0.5,
                                                        borderRadius: "8px",
                                                        background: isDark
                                                            ? "rgba(124,58,237,0.3)"
                                                            : "rgba(124,58,237,0.05)",
                                                        border: `1px solid ${styles.border}`,
                                                        fontFamily: "monospace",
                                                    }}
                                                >
                                                    <Typography
                                                        fontWeight={600}
                                                        sx={{
                                                            userSelect: "text",
                                                            color: styles.labelColor,
                                                            fontSize: "13px",
                                                            fontFamily: "monospace",
                                                        }}
                                                    >
                                                        {teamProfile.teamId}
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
                                                    {t.admin.teamProfile.owner}
                                                </FormLabel>
                                                {/* Name + email on one (wrap-friendly) row,
                                                    Transfer button on its own row below,
                                                    right-aligned. Keeps long usernames from
                                                    wrapping mid-line and gives each element
                                                    breathing room. */}
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
                                                            setAvatarUserId(
                                                                teamProfile.teamOwnerId
                                                            );
                                                            setOpenUserProfile(true);
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
                                                            {
                                                                useTEM.teamMemberProfiles[
                                                                    teamProfile?.teamOwnerId
                                                                ]?.userName
                                                            }
                                                        </Typography>
                                                    </Button>
                                                    <Typography
                                                        component="a"
                                                        href={`mailto:${
                                                            useTEM.teamMemberProfiles[
                                                                teamProfile?.teamOwnerId
                                                            ]?.userEmail
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
                                                        {
                                                            useTEM.teamMemberProfiles[
                                                                teamProfile?.teamOwnerId
                                                            ]?.userEmail
                                                        }
                                                    </Typography>
                                                </Stack>
                                                {/* Invite is ordinary management (this was THE
                                                    bottleneck — one person for every new hire),
                                                    so editors get it. Transferring ownership is
                                                    ownership itself and stays with the owner. */}
                                                {canManage && (
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            justifyContent: "flex-end",
                                                            flexWrap: "wrap",
                                                            gap: 1,
                                                            mt: 1,
                                                            mb: 1.5,
                                                        }}
                                                    >
                                                        <Button
                                                            size="sm"
                                                            variant="solid"
                                                            startDecorator={
                                                                <PersonAddAltRoundedIcon
                                                                    sx={{ fontSize: 16 }}
                                                                />
                                                            }
                                                            sx={{
                                                                borderRadius: "8px",
                                                                fontWeight: 600,
                                                                background:
                                                                    "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                                                "&:hover": {
                                                                    background:
                                                                        "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                                                                },
                                                            }}
                                                            onClick={() => setOpenInvite(true)}
                                                        >
                                                            {t.admin.inviteMembers.openButton}
                                                        </Button>
                                                        {isTeamOwner && (
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
                                                                onClick={() =>
                                                                    setOpenTransfer(true)
                                                                }
                                                            >
                                                                {
                                                                    t.common.profileEdit
                                                                        .transferOwner
                                                                }
                                                            </Button>
                                                        )}
                                                    </Box>
                                                )}
                                            </FormControl>

                                            {teamProfile.teamMembers.length > 0 && (
                                                <FormControl>
                                                    <Stack
                                                        direction={{ xs: "column", sm: "row" }}
                                                        justifyContent="space-between"
                                                        spacing={{ xs: 1, sm: 0 }}
                                                        sx={{ mb: 1 }}
                                                        alignItems={{
                                                            xs: "stretch",
                                                            sm: "center",
                                                        }}
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
                                                            {fmt(t.admin.teamProfile.members, {
                                                                filtered: filteredMembers.length,
                                                                total: teamProfile.teamMembers
                                                                    .length,
                                                            })}
                                                        </FormLabel>
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
                                                                t.admin.teamProfile.searchMembers
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
                                                                    borderColor:
                                                                        styles.accentColor,
                                                                },
                                                                "&:focus-within": {
                                                                    borderColor:
                                                                        styles.accentColor,
                                                                    boxShadow: isDark
                                                                        ? "0 0 0 2px rgba(124,58,237,0.2)"
                                                                        : "0 0 0 2px rgba(124,58,237,0.1)",
                                                                },
                                                            }}
                                                            onChange={(e) =>
                                                                setMemberSearchQuery(
                                                                    e.target.value
                                                                )
                                                            }
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
                                                                    key={`team-member-${member.userId}`}
                                                                    sx={{
                                                                        ml: 1,
                                                                        my: 0.3,
                                                                        borderRadius: "8px",
                                                                        transition:
                                                                            "all 0.2s ease",
                                                                        "&:hover": {
                                                                            background:
                                                                                styles.hoverBg,
                                                                        },
                                                                    }}
                                                                    onClick={() => {
                                                                        setAvatarUserId(
                                                                            member.userId
                                                                        );
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
                                                                    {/* Role sits at the row's
                                                                        trailing edge: a chip for
                                                                        everyone, a picker for
                                                                        managers. The owner always
                                                                        renders as a chip — their
                                                                        role changes by transfer,
                                                                        not by this control. */}
                                                                    <Box
                                                                        sx={{ ml: "auto", pl: 1 }}
                                                                    >
                                                                        <MemberRoleControl
                                                                            canManage={canManage}
                                                                            userId={member.userId}
                                                                            memberRole={
                                                                                member.memberRole
                                                                            }
                                                                            ownerUserId={
                                                                                teamProfile.teamOwnerId
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
                                                                        t.admin.teamProfile
                                                                            .noMembersFound,
                                                                        {
                                                                            query: memberSearchQuery,
                                                                        }
                                                                    )}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                </FormControl>
                                            )}

                                            <FormControl sx={{ mt: 1 }}>
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
                                                    {t.admin.teamProfile.createdDate}
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
                                                        {extractYYYYMMDD(teamProfile.tsCreatedAt)}
                                                    </Typography>
                                                </Box>
                                            </FormControl>

                                            {!isTeamOwner && (
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
                                                            borderColor: "rgba(232,121,195,0.4)",
                                                            color: "rgba(232,121,195,0.9)",
                                                            "&:hover": {
                                                                background:
                                                                    "rgba(232,121,195,0.08)",
                                                                borderColor:
                                                                    "rgba(232,121,195,0.6)",
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
                description={t.common.leaveConfirm.teamDescription}
                entityName={teamProfile.teamName}
                open={openLeaveConfirm}
                title={t.common.leaveConfirm.teamTitle}
                onCancel={() => setOpenLeaveConfirm(false)}
                onConfirm={handleLeaveTeam}
            />
            <ModalTransferOwner
                candidates={transferCandidates}
                description={t.common.profileEdit.transferTeamDescription}
                open={openTransfer}
                title={t.common.profileEdit.transferTitle}
                onCancel={() => setOpenTransfer(false)}
                onConfirm={handleTransferConfirm}
            />
            <ModalInviteMembers
                open={openInvite}
                teamId={teamProfile.teamId}
                onClose={() => setOpenInvite(false)}
            />
        </>
    );
};
