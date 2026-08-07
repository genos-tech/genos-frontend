import { useEffect, useRef, useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import {
    Avatar,
    Box,
    Button,
    Card,
    FormControl,
    FormLabel,
    IconButton,
    Modal,
    ModalClose,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useOptionalAvatarContext } from "../../../../components/ui/avatars/AvatarContext";
import { EmojiPicker } from "../../../../components/ui/emoji/EmojiPicker";
import { FileSizeRejectionSnackbar } from "../../../../components/ui/feedback/FileSizeRejectionSnackbar";
import { useFileSizeGuard } from "../../../../components/ui/feedback/useFileSizeGuard";
import { ExternalChip } from "../../../../components/ui/misc/ExternalChip";
import { ProfileModalStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { UserRepository } from "../../../../db/repositories/user";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { UserProps } from "../../../../types/admin";
import { ChannelKind, type Channel } from "../../../../types/channel";
import type { ChatProps } from "../../../../types/chat";
import { buildAvatarSrc } from "../../../../utils/avatarSrc";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { UserProfileAbout } from "./sub/UserProfileAbout";
import { UserProfileLocalTime } from "./sub/UserProfileLocalTime";
import { UserProfileLocation } from "./sub/UserProfileLocation";
import { UserProfilePhone } from "./sub/UserProfilePhone";
import { UserProfileRole } from "./sub/UserProfileRole";
import { UserProfileStatus } from "./sub/UserProfileStatus";

const base_url = import.meta.env.VITE_API_BASE_URL;

type UserProfileProps = {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    isYou: boolean;
    user?: UserProps;
    openUserProfile: boolean;
    setOpenUserProfile: (value: boolean) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};
export const UserProfile = (props: UserProfileProps) => {
    const {
        socket,
        setMyself,
        myself,
        isYou,
        user,
        openUserProfile,
        setOpenUserProfile,
        useCM,
        useUISM,
    } = props;

    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const styles = isDark ? ProfileModalStyles.dark : ProfileModalStyles.light;

    // Optional: this modal is also rendered from a few callsites that
    // pre-date the AvatarContextProvider (older sidebar paths, mention
    // popovers). When present we use the context to propagate avatar
    // updates to every other "you" avatar instantly; when absent we
    // simply skip the propagation and the next 60 s `popTeamUsersWorker`
    // tick will catch up.
    const avatarCtx = useOptionalAvatarContext();

    // Per-file size cap. Profile images are tiny by nature; the cap is
    // mostly a safety net against accidentally selecting a 4K RAW.
    const { rejection, dismissRejection, filterFiles } = useFileSizeGuard();

    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);

    const [profileUser, setProfileUser] = useState<UserProps | undefined>(
        isYou === true ? myself : user
    );
    useEffect(() => {
        if (isYou === true) {
            setProfileUser(myself);
        } else {
            setProfileUser(user);
        }
    }, [user, myself]);

    // Someone from another team is in this roster because a share put you
    // on the same object, so their row is filed under YOUR team: reading
    // `teamId` / `teamName` off it would tell you they work here. Their own
    // team travels alongside, and it is the answer to the question this
    // modal is usually opened to settle.
    const isExternal = profileUser?.isExternal === true;
    const shownTeamId = isExternal ? profileUser?.homeTeamId : profileUser?.teamId;
    const shownTeamName = isExternal ? profileUser?.homeTeamName : profileUser?.teamName;

    // Profile image file upload manager
    const inputRef = useRef<HTMLInputElement | null>(null);
    const handleButtonClick = () => {
        inputRef.current?.click();
    };
    const toProfileFileName = (originalFileName: string): string => {
        // Get the extension (including dot, e.g. ".png")
        const ext = originalFileName.substring(originalFileName.lastIndexOf("."));
        // return `profile${ext}`;

        // use always "jpg"
        return `profile.jpg`;
    };
    const handleSelectedFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (!selectedFiles || selectedFiles.length !== 1) return;

        // Reject oversize images before we do any wrapping / fetch work.
        // Reset the input so the user can retry with a smaller file.
        const accepted = filterFiles(selectedFiles);
        if (accepted.length === 0) {
            event.target.value = "";
            return;
        }

        const tmpUserProfileImage = accepted[0]; // original File

        // NOTE: This is the static path and is referred from backend as well.
        //       So, need to check backend when you need to change it.
        const newName = toProfileFileName(tmpUserProfileImage.name);

        // Create a new File instance with the existing file data but new name
        const userProfileImage = new File([tmpUserProfileImage], newName, {
            type: tmpUserProfileImage.type,
            lastModified: tmpUserProfileImage.lastModified,
        });

        const formData = new FormData();
        formData.append("user_profile_image", userProfileImage);
        const uploadProfileImageResponse = await fetch(`${base_url}/user/profile/image/`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
        });

        const uploadProfileImageData = await uploadProfileImageResponse.json();

        if (!uploadProfileImageResponse.ok) {
            throw new Error(t.admin.userProfile.uploadFailed);
        } else {
            const newPath = uploadProfileImageData.profile_image_file_name as string;
            localStorage.setItem("avatarImgPath", newPath);
            const updatedMyself: UserProps = { ...myself, avatarImgPath: newPath };
            setMyself(updatedMyself);

            // Keep the team-members map in sync so every avatar of "you"
            // (chat bubbles, task rows, comments, etc.) reflects the
            // upload immediately instead of waiting up to 60 s for the
            // next `popTeamUsersWorker` tick.
            avatarCtx?.setTeamMemberProfiles((prev) => {
                const existing = prev[myself.userId];
                return {
                    ...prev,
                    [myself.userId]: {
                        ...(existing ?? updatedMyself),
                        avatarImgPath: newPath,
                    },
                };
            });

            // Write through to IndexedDB so the next reload starts
            // consistent — without this the local cache still serves the
            // pre-upload path until the next worker pop overwrites it.
            try {
                const userRepo = new UserRepository();
                const cached = avatarCtx?.teamMemberProfiles[myself.userId] ?? updatedMyself;
                await userRepo.saveUser({ ...cached, avatarImgPath: newPath });
            } catch (err) {
                console.error("Failed to persist avatar update to IndexedDB:", err);
            }
        }
    };

    return (
        <>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
            <Modal
                open={openUserProfile}
                sx={{
                    zIndex: 10001,
                    backdropFilter: "blur(8px)",
                    backgroundColor: "transparent",
                }}
                onClose={() => setOpenUserProfile(false)}
            >
                <ModalDialog
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    sx={{
                        background: styles.bg,
                        border: `1px solid ${styles.border}`,
                        boxShadow: styles.shadow,
                        borderRadius: { xs: "0", md: "20px" },
                        // Clip horizontal overflow on mobile so over-wide
                        // children (UUID monospace strings, long status
                        // chips) can't make the dialog scroll sideways.
                        // Vertical scroll is delegated to the inner Box.
                        overflowX: "hidden",
                        overflowY: { xs: "hidden", md: "auto" },
                        transition: "all 0.3s ease",
                        width: { xs: "100vw", md: "min(900px, 90vw)" },
                        height: { xs: "100dvh", md: "auto" },
                        maxWidth: { xs: "100vw", md: "900px" },
                        maxHeight: { xs: "100dvh", md: "90vh" },
                        m: { xs: 0, md: "auto" },
                        p: 0,
                    }}
                >
                    <Box
                        sx={{
                            flex: 1,
                            width: "100%",
                            maxWidth: "100%",
                            minWidth: 0,
                            // Vertical scroll lives here so the dialog's
                            // outer overflow can stay clipped.
                            overflowY: { xs: "auto", md: "visible" },
                            overflowX: "hidden",
                            height: { xs: "100%", md: "auto" },
                            p: { xs: 1.5, md: 2 },
                        }}
                    >
                        {/* `useFixedPosition` portals the picker to document.body
                        with position:fixed + z-index 99999, side-stepping both
                        the modal's `overflow: hidden` clipping and the zero-
                        height `<div className="relative">` anchor inside the
                        picker. `calc(50vw - 175px)` horizontally centers a
                        ~350px-wide emoji-mart picker on any viewport. */}
                        <EmojiPicker
                            // customStatus is a plain string rendered in
                            // shortcode-blind surfaces — no team emoji here.
                            includeCustom={false}
                            pickerBottomPosition="20vh"
                            pickerLeftPosition="calc(50vw - 175px)"
                            setSelectedEmoji={setSelectedEmoji}
                            setShowEmojiPicker={setShowEmojiPicker}
                            showEmojiPicker={showEmojiPicker}
                            useFixedPosition
                        />
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
                                    {isYou === true
                                        ? t.admin.userProfile.myProfile
                                        : myself.userId !== profileUser?.userId
                                          ? profileUser?.userName
                                              ? fmt(t.admin.userProfile.othersProfile, {
                                                    userName: profileUser.userName,
                                                })
                                              : t.admin.userProfile.profileFallback
                                          : t.admin.userProfile.myProfile}
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
                            spacing={3}
                            sx={{
                                display: "flex",
                                mx: "auto",
                                px: { xs: 1, md: 3 },
                                py: { xs: 1, md: 2 },
                                width: "100%",
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
                                    p: { xs: 2, md: 3 },
                                    "&:hover": {
                                        boxShadow: isDark
                                            ? "0 8px 30px rgba(0,0,0,0.4)"
                                            : "0 8px 30px rgba(var(--gp-brand-700-rgb), 0.12)",
                                    },
                                }}
                            >
                                <Stack
                                    alignItems={{ xs: "stretch", md: "flex-start" }}
                                    direction={{ xs: "column", md: "row" }}
                                    spacing={{ xs: 2, md: 6 }}
                                    sx={{ width: "100%", minWidth: 0 }}
                                >
                                    <Box
                                        sx={{
                                            position: "relative",
                                            display: "flex",
                                            flexShrink: 0,
                                            alignSelf: { xs: "center", md: "auto" },
                                        }}
                                    >
                                        <Avatar
                                            src={buildAvatarSrc(profileUser?.avatarImgPath)}
                                            sx={{
                                                width: { xs: 100, md: 150 },
                                                height: { xs: 100, md: 150 },
                                                fontSize: { xs: "36px", md: "48px" },
                                                boxShadow: styles.avatarGlow,
                                                border: `3px solid ${styles.border}`,
                                                cursor: "pointer",
                                                transition: "all 0.3s ease",
                                                "&:hover": {
                                                    transform: "scale(1.02)",
                                                    boxShadow: isDark
                                                        ? "0 0 50px rgba(var(--gp-brand-700-rgb), 0.5), 0 0 100px rgba(var(--gp-brandalt-500-rgb), 0.3)"
                                                        : "0 0 50px rgba(var(--gp-brand-700-rgb), 0.3), 0 0 100px rgba(var(--gp-brandalt-500-rgb), 0.15)",
                                                },
                                            }}
                                            onClick={() => setOpenUserProfile(true)}
                                        >
                                            {profileUser?.userName[0]}
                                        </Avatar>

                                        {myself.userId === profileUser?.userId && (
                                            <Box
                                                sx={{
                                                    position: "absolute",
                                                    bottom: 0,
                                                    right: 0,
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
                                                <AppTooltip
                                                    size="sm"
                                                    title={t.admin.userProfile.editProfileImage}
                                                >
                                                    <IconButton
                                                        size="sm"
                                                        variant="soft"
                                                        sx={{
                                                            background: isDark
                                                                ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.3) 0%, rgba(var(--gp-brandalt-500-rgb), 0.3) 100%)"
                                                                : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.15) 0%, rgba(var(--gp-brandalt-500-rgb), 0.15) 100%)",
                                                            border: `1px solid ${styles.border}`,
                                                            transition: "all 0.2s ease",
                                                            "&:hover": {
                                                                background: isDark
                                                                    ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.5) 0%, rgba(var(--gp-brandalt-500-rgb), 0.5) 100%)"
                                                                    : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.25) 0%, rgba(var(--gp-brandalt-500-rgb), 0.25) 100%)",
                                                                transform: "scale(1.1)",
                                                            },
                                                        }}
                                                        onClick={handleButtonClick}
                                                    >
                                                        <EditIcon
                                                            sx={{
                                                                fontSize: "20px",
                                                                color: styles.accentColor,
                                                            }}
                                                        />
                                                    </IconButton>
                                                </AppTooltip>
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
                                        <UserProfileStatus
                                            isYou={isYou}
                                            myself={myself}
                                            selectedEmoji={selectedEmoji}
                                            setMyself={setMyself}
                                            setSelectedEmoji={setSelectedEmoji}
                                            setShowEmojiPicker={setShowEmojiPicker}
                                            user={user}
                                        />

                                        <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            flexWrap="wrap"
                                            spacing={2}
                                        >
                                            <Typography
                                                component="a"
                                                href={`mailto:${profileUser?.userEmail}`}
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
                                                    fontSize: "14px",
                                                    "&:hover": {
                                                        color: styles.accentColor,
                                                    },
                                                }}
                                            >
                                                {profileUser?.userEmail}
                                            </Typography>
                                            <UserProfilePhone
                                                myself={myself}
                                                setMyself={setMyself}
                                                user={profileUser}
                                            />
                                        </Stack>

                                        {/* Where they are and what time it is
                                            there — one question, so one row.
                                            Local time is derived from the
                                            location when they've set one and
                                            from their browser's zone
                                            otherwise, which is why it can
                                            appear without a location beside
                                            it. */}
                                        <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            spacing={{ xs: 1, sm: 2 }}
                                            sx={{ alignItems: { xs: "flex-start", sm: "center" } }}
                                        >
                                            <UserProfileLocation
                                                myself={myself}
                                                setMyself={setMyself}
                                                user={profileUser}
                                            />
                                            <UserProfileLocalTime user={profileUser} />
                                        </Stack>

                                        {/* Rendered by the child only when
                                            there's something to show, so the
                                            label has to be gated the same way
                                            or an empty "ABOUT" heading floats
                                            above nothing on other people's
                                            profiles. */}
                                        {(profileUser?.aboutMe ||
                                            myself.userId === profileUser?.userId) && (
                                            <FormControl>
                                                <FormLabel
                                                    sx={{
                                                        color: styles.labelColor,
                                                        fontSize: "0.7rem",
                                                        fontWeight: 600,
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.05em",
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    {t.admin.userProfile.about}
                                                </FormLabel>
                                                <UserProfileAbout
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    user={profileUser}
                                                />
                                            </FormControl>
                                        )}

                                        {/* Team Name */}
                                        <FormControl>
                                            <FormLabel
                                                sx={{
                                                    color: styles.labelColor,
                                                    fontSize: "0.7rem",
                                                    fontWeight: 600,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                    mb: 0.5,
                                                }}
                                            >
                                                {t.admin.userProfile.teamName}
                                            </FormLabel>
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                sx={{ alignItems: "center" }}
                                            >
                                                <Box
                                                    sx={{
                                                        px: 1.5,
                                                        py: 0.75,
                                                        borderRadius: "8px",
                                                        background: isDark
                                                            ? "rgba(var(--gp-brand-700-rgb), 0.1)"
                                                            : "rgba(var(--gp-brand-700-rgb), 0.05)",
                                                        border: `1px solid ${styles.border}`,
                                                        display: "inline-flex",
                                                        width: "fit-content",
                                                    }}
                                                >
                                                    <Typography
                                                        fontWeight="bold"
                                                        sx={{
                                                            userSelect: "text",
                                                            color: styles.valueColor,
                                                            fontSize: "14px",
                                                        }}
                                                    >
                                                        {shownTeamName}
                                                    </Typography>
                                                </Box>
                                                {isExternal && (
                                                    <ExternalChip
                                                        hint={t.admin.userProfile.externalHint}
                                                        label={t.admin.userProfile.externalBadge}
                                                    />
                                                )}
                                            </Stack>
                                        </FormControl>

                                        {/* IDs Row */}
                                        <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            spacing={2}
                                            sx={{ width: "100%", minWidth: 0 }}
                                        >
                                            <FormControl
                                                sx={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    width: "100%",
                                                }}
                                            >
                                                <FormLabel
                                                    sx={{
                                                        color: styles.labelColor,
                                                        fontSize: "0.7rem",
                                                        fontWeight: 600,
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.05em",
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    {t.admin.userProfile.teamId}
                                                </FormLabel>
                                                <Box
                                                    sx={{
                                                        px: 1.5,
                                                        py: 0.5,
                                                        borderRadius: "6px",
                                                        background: isDark
                                                            ? "rgba(var(--gp-brand-700-rgb), 0.3)"
                                                            : "rgba(var(--gp-brand-700-rgb), 0.05)",
                                                        border: `1px solid ${styles.border}`,
                                                        overflow: "hidden",
                                                        width: "100%",
                                                        maxWidth: "100%",
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    <Typography
                                                        fontWeight={600}
                                                        sx={{
                                                            userSelect: "text",
                                                            color: styles.labelColor,
                                                            fontSize: "11px",
                                                            fontFamily: "monospace",
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {shownTeamId}
                                                    </Typography>
                                                </Box>
                                            </FormControl>
                                            <FormControl
                                                sx={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    width: "100%",
                                                }}
                                            >
                                                <FormLabel
                                                    sx={{
                                                        color: styles.labelColor,
                                                        fontSize: "0.7rem",
                                                        fontWeight: 600,
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.05em",
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    {t.admin.userProfile.userId}
                                                </FormLabel>
                                                <Box
                                                    sx={{
                                                        px: 1.5,
                                                        py: 0.5,
                                                        borderRadius: "6px",
                                                        background: isDark
                                                            ? "rgba(var(--gp-brand-700-rgb), 0.3)"
                                                            : "rgba(var(--gp-brand-700-rgb), 0.05)",
                                                        border: `1px solid ${styles.border}`,
                                                        overflow: "hidden",
                                                        width: "100%",
                                                        maxWidth: "100%",
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    <Typography
                                                        fontWeight={600}
                                                        sx={{
                                                            userSelect: "text",
                                                            color: styles.labelColor,
                                                            fontSize: "11px",
                                                            fontFamily: "monospace",
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {profileUser?.userId}
                                                    </Typography>
                                                </Box>
                                            </FormControl>
                                        </Stack>

                                        {/* Role & Joined Row. Country used to
                                            sit between them; it is now the
                                            Location row above, which answers
                                            the same question more precisely
                                            and carries the timezone with it. */}
                                        <Stack direction="column" spacing={2}>
                                            <FormControl sx={{ flex: 1 }}>
                                                <FormLabel
                                                    sx={{
                                                        color: styles.labelColor,
                                                        fontSize: "0.7rem",
                                                        fontWeight: 600,
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.05em",
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    {t.admin.userProfile.role}
                                                </FormLabel>
                                                <UserProfileRole
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    user={profileUser}
                                                />
                                            </FormControl>
                                            <FormControl sx={{ flex: 1 }}>
                                                <FormLabel
                                                    sx={{
                                                        color: styles.labelColor,
                                                        fontSize: "0.7rem",
                                                        fontWeight: 600,
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.05em",
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    {t.admin.userProfile.joinedDate}
                                                </FormLabel>
                                                <Box
                                                    sx={{
                                                        display: "inline-flex",
                                                        px: 1.5,
                                                        py: 0.5,
                                                        borderRadius: "6px",
                                                        background: isDark
                                                            ? "rgba(var(--gp-brand-700-rgb), 0.1)"
                                                            : "rgba(var(--gp-brand-700-rgb), 0.05)",
                                                        border: `1px solid ${styles.border}`,
                                                        width: "fit-content",
                                                    }}
                                                >
                                                    <Typography
                                                        fontWeight={600}
                                                        sx={{
                                                            userSelect: "text",
                                                            color: styles.valueColor,
                                                            fontSize: "13px",
                                                        }}
                                                    >
                                                        {profileUser &&
                                                        profileUser?.tsJoined !== "" &&
                                                        profileUser?.tsJoined !== "N/A"
                                                            ? extractYYYYMMDD(profileUser.tsJoined)
                                                            : t.admin.userProfile.notAvailable}
                                                    </Typography>
                                                </Box>
                                            </FormControl>
                                        </Stack>
                                    </Stack>
                                </Stack>
                            </Card>
                        </Stack>
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "flex-end",
                                px: { xs: 1, md: 3 },
                                pb: 1,
                            }}
                        >
                            <AppTooltip
                                title={
                                    isYou === true
                                        ? t.admin.userProfile.dmToMyself
                                        : profileUser?.userName
                                          ? fmt(t.admin.userProfile.dmToUser, {
                                                userName: profileUser.userName,
                                            })
                                          : t.admin.userProfile.dmToUserFallback
                                }
                            >
                                <Button
                                    size="sm"
                                    variant="outlined"
                                    startDecorator={
                                        <QuestionAnswerRoundedIcon
                                            sx={{
                                                color: styles.accentColor,
                                                fontSize: "18px",
                                            }}
                                        />
                                    }
                                    sx={{
                                        fontSize: "14px",
                                        px: 2,
                                        py: 0.75,
                                        borderRadius: "10px",
                                        background: isDark
                                            ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.2) 0%, rgba(var(--gp-brandalt-500-rgb), 0.2) 100%)"
                                            : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.1) 0%, rgba(var(--gp-brandalt-500-rgb), 0.1) 100%)",
                                        border: `1px solid ${styles.border}`,
                                        color: styles.valueColor,
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            background: isDark
                                                ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.4) 0%, rgba(var(--gp-brandalt-500-rgb), 0.4) 100%)"
                                                : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.2) 0%, rgba(var(--gp-brandalt-500-rgb), 0.2) 100%)",
                                            transform: "translateY(-2px)",
                                            boxShadow: isDark
                                                ? "0 4px 12px rgba(var(--gp-brand-700-rgb), 0.3)"
                                                : "0 4px 12px rgba(var(--gp-brand-700-rgb), 0.2)",
                                        },
                                    }}
                                    onClick={() => {
                                        (async () => {
                                            if (!profileUser) return;
                                            // v3 DM open. Scan v3 snapshot for an
                                            // existing DM with this partner; if
                                            // none, ask the backend to create one
                                            // (`channelService.createChannel`'s
                                            // idempotency via `ChannelDirectPair`
                                            // returns the existing channel if it
                                            // already exists server-side but the
                                            // FE snapshot hasn't caught up yet).
                                            const snapshot = channelService.getSnapshot();
                                            let channel: Channel | undefined;
                                            for (const c of snapshot.channels.values()) {
                                                if (c.kind !== ChannelKind.DM) continue;
                                                const roster =
                                                    snapshot.membersByChannel.get(c.id) ?? [];
                                                const ids = new Set(roster.map((m) => m.userId));
                                                if (
                                                    ids.size === 2 &&
                                                    ids.has(myself.userId) &&
                                                    ids.has(profileUser.userId)
                                                ) {
                                                    channel = c;
                                                    break;
                                                }
                                            }
                                            if (!channel) {
                                                try {
                                                    channel = await channelService.createChannel({
                                                        kind: ChannelKind.DM,
                                                        otherUserId: profileUser.userId,
                                                        teamId: myself.teamId,
                                                    });
                                                } catch (e) {
                                                    console.error(
                                                        "[ModalUserProfile] DM create failed:",
                                                        e
                                                    );
                                                    return;
                                                }
                                            }
                                            if (!channel) return;
                                            const initialChat: ChatProps = {
                                                chatId: channel.id,
                                                chatName: profileUser.userName,
                                                chatType: 1,
                                                dmPartnerUser: profileUser,
                                                isPrivate: channel.isPrivate,
                                                lastReadMessageId: "",
                                                latestMessage:
                                                    undefined as unknown as ChatProps["latestMessage"],
                                                latestMessageText: "",
                                                messages: [],
                                                profileImagePath:
                                                    channel.profileImageUrl || undefined,
                                                TSLastMessage:
                                                    channel.tsUpdated ?? channel.tsCreated ?? "",
                                            };
                                            useCM.setCurrentMainChat(initialChat);
                                            useCM.setIsMainChatVisible(true);
                                            setOpenUserProfile(false);
                                            navigate("/workspace/chat");
                                        })();
                                    }}
                                >
                                    {t.admin.userProfile.sendDm}
                                </Button>
                            </AppTooltip>
                        </Box>
                    </Box>
                </ModalDialog>
            </Modal>
        </>
    );
};
