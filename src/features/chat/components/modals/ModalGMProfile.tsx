import { useEffect, useMemo, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import SearchIcon from "@mui/icons-material/Search";
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
    ModalDialog,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { FileSizeRejectionSnackbar } from "../../../../components/ui/feedback/FileSizeRejectionSnackbar";
import { useFileSizeGuard } from "../../../../components/ui/feedback/useFileSizeGuard";
import { ProfileModalStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, GMProfileProps } from "../../../../types/chat";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import {
    bumpGMProfileImageVersion,
    useGMProfileImageVersion,
} from "../../../../utils/gmProfileImageVersion";
import { addChat } from "../../services/addChat";
import { loadGMProfile } from "../../services/loadGMProfile";

const base_url = import.meta.env.VITE_API_BASE_URL;
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

    const [gmProfile, setGmProfile] = useState<GMProfileProps | null>(null);

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
    const imageVersion = useGMProfileImageVersion(gmChat.chatType, gmChat.chatId);
    const avatarSrc = liveChat.profileImagePath
        ? `${media_url}/${liveChat.profileImagePath}${imageVersion > 0 ? `?v=${imageVersion}` : ""}`
        : undefined;

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
        formData.append("gm_id", gmChat.chatId.toString());
        const uploadProfileImageResponse = await fetch(`${base_url}/gm/profile/image/`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
        });

        const uploadProfileImageData = await uploadProfileImageResponse.json();

        if (!uploadProfileImageResponse.ok) {
            throw new Error(t.chat.modals.gmProfile.uploadImageError);
        } else {
            // Await both writes so `funcSetAllChats()` reads the
            // updated IndexedDB row instead of racing the worker
            // postMessage. Without this the in-memory `allChats`
            // refresh can pick up the pre-upload row and the avatar
            // stays stale even with the cache-buster.
            await addChat(
                {
                    ...gmChat,
                    profileImagePath: uploadProfileImageData.profile_image_file_name,
                },
                gmChat.chatType
            );
            await useCM.funcSetAllChats();
            // Bump the per-chat image version so this modal and
            // every mounted GMAvatar refetch with a fresh `?v=N`
            // query string — covers the case where the backend
            // wrote the new bytes under the same filename.
            bumpGMProfileImageVersion(gmChat.chatType, gmChat.chatId);
        }
    };

    const loadGMProfileData = async () => {
        const gmProfile = await loadGMProfile(myself.teamId, gmChat.chatId, accessToken);
        setGmProfile(gmProfile);
    };

    useEffect(() => {
        if (openModalGMProfile) {
            loadGMProfileData();
            setMemberSearchQuery("");
        }
    }, [openModalGMProfile]);

    return (
        <>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
            <Modal
                open={openModalGMProfile}
                sx={{
                    zIndex: 10001,
                    backdropFilter: "blur(8px)",
                    backgroundColor: "transparent",
                }}
                onClose={() => setOpenModalGMProfile(false)}
            >
                <ModalDialog
                    sx={{
                        background: styles.bg,
                        border: `1px solid ${styles.border}`,
                        boxShadow: styles.shadow,
                        borderRadius: "20px",
                        overflow: "hidden",
                        transition: "all 0.3s ease",
                    }}
                >
                    <Box sx={{ flex: 1, width: "1000px" }}>
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
                                    Group Message Profile - {gmChat.chatName}
                                </Typography>
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
                                                        ? "0 0 50px rgba(124,58,237,0.5), 0 0 100px rgba(168,85,247,0.3)"
                                                        : "0 0 50px rgba(124,58,237,0.3), 0 0 100px rgba(168,85,247,0.15)",
                                                },
                                            }}
                                        >
                                            <GroupsRoundedIcon sx={{ fontSize: 100 }} />
                                        </Avatar>

                                        {/* Edit Button */}
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
                                                title={t.chat.modals.gmProfile.editProfileImageTooltip}
                                                variant="outlined"
                                            >
                                                <IconButton
                                                    variant="soft"
                                                    sx={{
                                                        background: isDark
                                                            ? "linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(168,85,247,0.3) 100%)"
                                                            : "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(168,85,247,0.15) 100%)",
                                                        border: `1px solid ${styles.border}`,
                                                        transition: "all 0.2s ease",
                                                        "&:hover": {
                                                            background: isDark
                                                                ? "linear-gradient(135deg, rgba(124,58,237,0.5) 0%, rgba(168,85,247,0.5) 100%)"
                                                                : "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(168,85,247,0.25) 100%)",
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
                                    </Box>

                                    {/* Details Section */}
                                    <Stack spacing={2} sx={{ flexGrow: 1 }}>
                                        <Stack direction="column" spacing={1.5}>
                                            {/* Owner */}
                                            <Stack
                                                direction="row"
                                                alignItems="flex-end"
                                                spacing={2}
                                            >
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
                                                            }}
                                                        >
                                                            {gmProfile
                                                                ? useTEM.teamMemberProfiles[
                                                                      gmProfile?.ownerUserId
                                                                  ]?.userName
                                                                : t.chat.modals.gmProfile.na}
                                                        </Typography>
                                                    </Button>
                                                </FormControl>

                                                <Typography
                                                    component="a"
                                                    href={`mailto:${
                                                        gmProfile
                                                            ? useTEM.teamMemberProfiles[
                                                                  gmProfile?.ownerUserId
                                                              ]?.userEmail
                                                            : t.chat.modals.gmProfile.na
                                                    }`}
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
                                                        pb: "8px",
                                                        transition: "all 0.2s ease",
                                                        "&:hover": {
                                                            color: styles.accentColor,
                                                        },
                                                    }}
                                                >
                                                    {gmProfile
                                                        ? useTEM.teamMemberProfiles[
                                                              gmProfile?.ownerUserId
                                                          ]?.userEmail
                                                        : t.chat.modals.gmProfile.na}
                                                </Typography>
                                            </Stack>

                                            {/* Members with Search */}
                                            <FormControl>
                                                <Stack
                                                    direction="row"
                                                    alignItems="center"
                                                    justifyContent="space-between"
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
                                                        {fmt(t.chat.modals.gmProfile.membersCount, {
                                                            filtered: filteredMembers.length,
                                                            total: gmProfile?.gmMembers?.length || 0,
                                                        })}
                                                    </FormLabel>
                                                    <Input
                                                        placeholder={t.chat.modals.gmProfile.searchMembersPlaceholder}
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
                                                            width: "220px",
                                                            "--Input-focusedThickness": "1px",
                                                            "--Input-radius": "8px",
                                                            background: styles.inputBg,
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
                                                                {fmt(t.chat.modals.gmProfile.noMembersFound, { query: memberSearchQuery })}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Box>
                                            </FormControl>

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
                                                                    ? "linear-gradient(135deg, rgba(232,121,195,0.2) 0%, rgba(192,38,168,0.2) 100%)"
                                                                    : "linear-gradient(135deg, rgba(232,121,195,0.15) 0%, rgba(192,38,168,0.15) 100%)"
                                                                : isDark
                                                                  ? "linear-gradient(135deg, rgba(192,132,252,0.2) 0%, rgba(168,85,247,0.2) 100%)"
                                                                  : "linear-gradient(135deg, rgba(147,51,234,0.12) 0%, rgba(126,34,206,0.12) 100%)",
                                                            border: `1px solid ${
                                                                gmProfile?.isPrivate
                                                                    ? "rgba(232,121,195,0.3)"
                                                                    : "rgba(192,132,252,0.3)"
                                                            }`,
                                                        }}
                                                    >
                                                        <Typography
                                                            fontWeight={600}
                                                            sx={{
                                                                userSelect: "text",
                                                                color: gmProfile?.isPrivate
                                                                    ? isDark
                                                                        ? "#e879c3"
                                                                        : "#c026a8"
                                                                    : isDark
                                                                      ? "#c084fc"
                                                                      : "#9333ea",
                                                            }}
                                                        >
                                                            {gmProfile?.isPrivate ? t.chat.modals.gmProfile.yes : t.chat.modals.gmProfile.no}
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
                                                            {gmProfile?.tsCreatedAt
                                                                ? extractYYYYMMDD(
                                                                      gmProfile.tsCreatedAt
                                                                  )
                                                                : t.chat.modals.gmProfile.na}
                                                        </Typography>
                                                    </Box>
                                                </FormControl>
                                            </Stack>
                                        </Stack>
                                    </Stack>
                                </Stack>
                            </Card>
                        </Stack>
                    </Box>
                </ModalDialog>
            </Modal>
        </>
    );
};
