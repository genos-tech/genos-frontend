import { useEffect, useRef, useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LocalPhoneIcon from "@mui/icons-material/LocalPhone";
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
    ModalDialog,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { useOptionalAvatarContext } from "../../../../components/ui/avatars/AvatarContext";
import { EmojiPicker } from "../../../../components/ui/emoji/EmojiPicker";
import { FileSizeRejectionSnackbar } from "../../../../components/ui/feedback/FileSizeRejectionSnackbar";
import { useFileSizeGuard } from "../../../../components/ui/feedback/useFileSizeGuard";
import { useAuth } from "../../../../context/AuthContext";
import { UserRepository } from "../../../../db/repositories/user";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { loadDMIdByUserId } from "../../../chat/services/loadDMIdByUserId";
import { moveToDMChat } from "../../../chat/services/moveToChat";
import { UserProfileBaseCountry } from "./sub/UserProfileBaseCountry";
import { UserProfileRole } from "./sub/UserProfileRole";
import { UserProfileStatus } from "./sub/UserProfileStatus";

const base_url = import.meta.env.VITE_API_BASE_URL;
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

// Modern theme-aware styling
const MODAL_STYLES = {
    dark: {
        bg: "linear-gradient(145deg, rgba(30,32,44,0.98) 0%, rgba(20,22,34,0.99) 100%)",
        cardBg: "linear-gradient(135deg, rgba(40,42,54,0.9) 0%, rgba(30,32,44,0.95) 100%)",
        border: "rgba(244,114,182,0.2)",
        shadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(244,114,182,0.1)",
        headerGradient: "linear-gradient(90deg, #f472b6 0%, #fb923c 50%, #fbbf24 100%)",
        labelColor: "rgba(148,163,184,0.9)",
        valueColor: "#f1f5f9",
        hoverBg: "rgba(244,114,182,0.15)",
        avatarGlow: "0 0 40px rgba(244,114,182,0.4), 0 0 80px rgba(251,146,60,0.2)",
        accentColor: "#f472b6",
    },
    light: {
        bg: "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.99) 100%)",
        cardBg: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(241,245,249,0.9) 100%)",
        border: "rgba(219,39,119,0.15)",
        shadow: "0 8px 32px rgba(219,39,119,0.1), 0 0 0 1px rgba(219,39,119,0.08)",
        headerGradient: "linear-gradient(90deg, #db2777 0%, #ea580c 50%, #d97706 100%)",
        labelColor: "rgba(71,85,105,0.9)",
        valueColor: "#1e293b",
        hoverBg: "rgba(219,39,119,0.08)",
        avatarGlow: "0 0 40px rgba(219,39,119,0.2), 0 0 80px rgba(234,88,12,0.1)",
        accentColor: "#db2777",
    },
};

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
    const isDark = mode === "dark";
    const styles = isDark ? MODAL_STYLES.dark : MODAL_STYLES.light;

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
            throw new Error("Failed to upload user profile image.");
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
                    sx={{
                        background: styles.bg,
                        border: `1px solid ${styles.border}`,
                        boxShadow: styles.shadow,
                        borderRadius: "20px",
                        overflow: "hidden",
                        transition: "all 0.3s ease",
                        width: "min(900px, 90vw)",
                        maxWidth: "900px",
                        p: 0,
                    }}
                >
                    <Box sx={{ flex: 1, width: "100%", p: 2 }}>
                        <EmojiPicker
                            setSelectedEmoji={setSelectedEmoji}
                            setShowEmojiPicker={setShowEmojiPicker}
                            showEmojiPicker={showEmojiPicker}
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
                                    px: 3,
                                }}
                            >
                                <Typography
                                    component="h1"
                                    level="h2"
                                    sx={{
                                        mt: 1,
                                        mb: 1,
                                        background: styles.headerGradient,
                                        backgroundClip: "text",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                        fontWeight: 700,
                                        letterSpacing: "-0.02em",
                                    }}
                                >
                                    {isYou === true
                                        ? "My Profile"
                                        : myself.userId !== profileUser?.userId
                                          ? profileUser?.userName
                                              ? `${profileUser?.userName}'s Profile`
                                              : "Profile"
                                          : "My Profile"}
                                </Typography>
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
                                        : "0 4px 20px rgba(219,39,119,0.08)",
                                    transition: "all 0.3s ease",
                                    p: { xs: 2, md: 3 },
                                    "&:hover": {
                                        boxShadow: isDark
                                            ? "0 8px 30px rgba(0,0,0,0.4)"
                                            : "0 8px 30px rgba(219,39,119,0.12)",
                                    },
                                }}
                            >
                                <Stack
                                    direction={{ xs: "column", md: "row" }}
                                    spacing={3}
                                    alignItems={{ xs: "center", md: "flex-start" }}
                                >
                                    <Box
                                        sx={{
                                            position: "relative",
                                            display: "flex",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Avatar
                                            src={`${media_url}/${profileUser?.avatarImgPath}`}
                                            sx={{
                                                width: 150,
                                                height: 150,
                                                fontSize: "48px",
                                                boxShadow: styles.avatarGlow,
                                                border: `3px solid ${styles.border}`,
                                                cursor: "pointer",
                                                transition: "all 0.3s ease",
                                                "&:hover": {
                                                    transform: "scale(1.02)",
                                                    boxShadow: isDark
                                                        ? "0 0 50px rgba(244,114,182,0.5), 0 0 100px rgba(251,146,60,0.3)"
                                                        : "0 0 50px rgba(219,39,119,0.3), 0 0 100px rgba(234,88,12,0.15)",
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
                                                <Tooltip
                                                    size="sm"
                                                    sx={{ zIndex: 9000 }}
                                                    title="Edit Profile Image"
                                                    variant="outlined"
                                                >
                                                    <IconButton
                                                        variant="soft"
                                                        size="sm"
                                                        sx={{
                                                            background: isDark
                                                                ? "linear-gradient(135deg, rgba(244,114,182,0.3) 0%, rgba(251,146,60,0.3) 100%)"
                                                                : "linear-gradient(135deg, rgba(219,39,119,0.15) 0%, rgba(234,88,12,0.15) 100%)",
                                                            border: `1px solid ${styles.border}`,
                                                            transition: "all 0.2s ease",
                                                            "&:hover": {
                                                                background: isDark
                                                                    ? "linear-gradient(135deg, rgba(244,114,182,0.5) 0%, rgba(251,146,60,0.5) 100%)"
                                                                    : "linear-gradient(135deg, rgba(219,39,119,0.25) 0%, rgba(234,88,12,0.25) 100%)",
                                                                transform: "scale(1.1)",
                                                            },
                                                        }}
                                                        onClick={handleButtonClick}
                                                    >
                                                        <EditIcon
                                                            sx={{
                                                                fontSize: "20px",
                                                                color: isDark
                                                                    ? "#f472b6"
                                                                    : "#db2777",
                                                            }}
                                                        />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        )}
                                    </Box>

                                    <Stack spacing={2} sx={{ flexGrow: 1, minWidth: 0 }}>
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
                                            spacing={2}
                                            flexWrap="wrap"
                                        >
                                            <Typography
                                                component="a"
                                                href={`mailto:${profileUser?.userEmail}`}
                                                startDecorator={
                                                    <EmailRoundedIcon
                                                        fontSize="small"
                                                        sx={{
                                                            color: isDark ? "#f472b6" : "#db2777",
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
                                                        color: isDark ? "#fb923c" : "#ea580c",
                                                    },
                                                }}
                                            >
                                                {profileUser?.userEmail}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    userSelect: "text",
                                                    color: styles.valueColor,
                                                    fontSize: "14px",
                                                }}
                                                startDecorator={
                                                    <LocalPhoneIcon
                                                        fontSize="small"
                                                        sx={{
                                                            color: isDark ? "#fbbf24" : "#d97706",
                                                        }}
                                                    />
                                                }
                                            >
                                                +81 999-888-777
                                            </Typography>
                                        </Stack>

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
                                                Team Name
                                            </FormLabel>
                                            <Box
                                                sx={{
                                                    px: 1.5,
                                                    py: 0.75,
                                                    borderRadius: "8px",
                                                    background: isDark
                                                        ? "rgba(244,114,182,0.1)"
                                                        : "rgba(219,39,119,0.05)",
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
                                                    {profileUser?.teamName}
                                                </Typography>
                                            </Box>
                                        </FormControl>

                                        {/* IDs Row */}
                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                            <FormControl sx={{ flex: 1, minWidth: 0 }}>
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
                                                    Team ID
                                                </FormLabel>
                                                <Box
                                                    sx={{
                                                        px: 1.5,
                                                        py: 0.5,
                                                        borderRadius: "6px",
                                                        background: isDark
                                                            ? "rgba(0,0,0,0.3)"
                                                            : "rgba(0,0,0,0.05)",
                                                        border: `1px solid ${styles.border}`,
                                                        overflow: "hidden",
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
                                                        {profileUser?.teamId}
                                                    </Typography>
                                                </Box>
                                            </FormControl>
                                            <FormControl sx={{ flex: 1, minWidth: 0 }}>
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
                                                    User ID
                                                </FormLabel>
                                                <Box
                                                    sx={{
                                                        px: 1.5,
                                                        py: 0.5,
                                                        borderRadius: "6px",
                                                        background: isDark
                                                            ? "rgba(0,0,0,0.3)"
                                                            : "rgba(0,0,0,0.05)",
                                                        border: `1px solid ${styles.border}`,
                                                        overflow: "hidden",
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

                                        {/* Role & Country Row */}
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
                                                    Role
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
                                                    Country
                                                </FormLabel>
                                                <UserProfileBaseCountry
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
                                                    Joined Date
                                                </FormLabel>
                                                <Box
                                                    sx={{
                                                        display: "inline-flex",
                                                        px: 1.5,
                                                        py: 0.5,
                                                        borderRadius: "6px",
                                                        background: isDark
                                                            ? "rgba(244,114,182,0.1)"
                                                            : "rgba(219,39,119,0.05)",
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
                                                            : "N/A"}
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
                            <Tooltip
                                title={
                                    isYou === true
                                        ? "DM to myself"
                                        : `DM to ${profileUser?.userName || "the user"}`
                                }
                                variant="outlined"
                                sx={{ zIndex: 10100 }}
                            >
                                <Button
                                    size="sm"
                                    variant="outlined"
                                    startDecorator={
                                        <QuestionAnswerRoundedIcon
                                            sx={{
                                                color: isDark ? "#f472b6" : "#db2777",
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
                                            ? "linear-gradient(135deg, rgba(244,114,182,0.2) 0%, rgba(251,146,60,0.2) 100%)"
                                            : "linear-gradient(135deg, rgba(219,39,119,0.1) 0%, rgba(234,88,12,0.1) 100%)",
                                        border: `1px solid ${styles.border}`,
                                        color: styles.valueColor,
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            background: isDark
                                                ? "linear-gradient(135deg, rgba(244,114,182,0.4) 0%, rgba(251,146,60,0.4) 100%)"
                                                : "linear-gradient(135deg, rgba(219,39,119,0.2) 0%, rgba(234,88,12,0.2) 100%)",
                                            transform: "translateY(-2px)",
                                            boxShadow: isDark
                                                ? "0 4px 12px rgba(244,114,182,0.3)"
                                                : "0 4px 12px rgba(219,39,119,0.2)",
                                        },
                                    }}
                                    onClick={() => {
                                        (async () => {
                                            if (profileUser) {
                                                const chatId: number = await loadDMIdByUserId(
                                                    myself,
                                                    profileUser?.userId,
                                                    accessToken
                                                );
                                                await moveToDMChat(
                                                    socket,
                                                    chatId,
                                                    profileUser?.userName,
                                                    profileUser,
                                                    useCM
                                                );
                                                setOpenUserProfile(false);
                                                navigate("/home/chat");
                                            }
                                        })();
                                    }}
                                >
                                    Send DM
                                </Button>
                            </Tooltip>
                        </Box>
                    </Box>
                </ModalDialog>
            </Modal>
        </>
    );
};
