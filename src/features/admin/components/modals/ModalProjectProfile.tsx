import { useEffect, useMemo, useRef, useState } from "react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
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
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { loadProjectProfile } from "../../../../services/loadProjectProfile";
import { ProjectProfileProps, UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { addChat } from "../../../chat/services/addChat";

const base_url = import.meta.env.VITE_API_BASE_URL;
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

// Modern theme-aware styling
const MODAL_STYLES = {
    dark: {
        bg: "linear-gradient(145deg, rgba(30,32,44,0.98) 0%, rgba(20,22,34,0.99) 100%)",
        cardBg: "linear-gradient(135deg, rgba(40,42,54,0.9) 0%, rgba(30,32,44,0.95) 100%)",
        border: "rgba(99,102,241,0.2)",
        shadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.1)",
        headerGradient: "linear-gradient(90deg, #818cf8 0%, #a78bfa 50%, #c084fc 100%)",
        labelColor: "rgba(148,163,184,0.9)",
        valueColor: "#f1f5f9",
        hoverBg: "rgba(99,102,241,0.15)",
        avatarGlow: "0 0 40px rgba(99,102,241,0.4), 0 0 80px rgba(139,92,246,0.2)",
    },
    light: {
        bg: "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.99) 100%)",
        cardBg: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(241,245,249,0.9) 100%)",
        border: "rgba(99,102,241,0.15)",
        shadow: "0 8px 32px rgba(99,102,241,0.1), 0 0 0 1px rgba(99,102,241,0.08)",
        headerGradient: "linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)",
        labelColor: "rgba(71,85,105,0.9)",
        valueColor: "#1e293b",
        hoverBg: "rgba(99,102,241,0.08)",
        avatarGlow: "0 0 40px rgba(99,102,241,0.2), 0 0 80px rgba(139,92,246,0.1)",
    },
};

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
    const isDark = mode === "dark";
    const styles = isDark ? MODAL_STYLES.dark : MODAL_STYLES.light;

    const [projectProfile, setProjectProfile] = useState<ProjectProfileProps | null>(null);

    // Member search state
    const [memberSearchQuery, setMemberSearchQuery] = useState("");

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
    const handleSelectedFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (pmChat.project) {
            const selectedFiles = event.target.files;
            if (!selectedFiles || selectedFiles.length !== 1) return;

            const tmpProjectProfileImage = selectedFiles[0]; // original File

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
                throw new Error("Failed to upload user profile image.");
            } else {
                addChat(
                    {
                        ...pmChat,
                        profileImagePath: uploadProfileImageData.profile_image_file_name,
                    },
                    pmChat.chatType
                );
                await useCM.funcSetAllChats();
            }
        }
    };

    const loadProjectProfileData = async () => {
        const projectProfile = await loadProjectProfile(myself.teamId, pmChat.chatId, accessToken);
        setProjectProfile(projectProfile);
    };

    useEffect(() => {
        if (openModalProjectProfile) {
            loadProjectProfileData();
        }
    }, [openModalProjectProfile]);

    return (
        <>
            <Modal
                open={openModalProjectProfile}
                sx={{
                    zIndex: 10001,
                    backdropFilter: "blur(8px)",
                    backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.3)",
                }}
                onClose={() => setOpenModalProjectProfile(false)}
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
                                    Project Profile - {pmChat.chatName}
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
                                        : "0 4px 20px rgba(99,102,241,0.08)",
                                    transition: "all 0.3s ease",
                                    "&:hover": {
                                        boxShadow: isDark
                                            ? "0 8px 30px rgba(0,0,0,0.4)"
                                            : "0 8px 30px rgba(99,102,241,0.12)",
                                    },
                                }}
                            >
                                <Stack
                                    direction="row"
                                    sx={{ display: { xs: "none", md: "flex" }, my: 1 }}
                                >
                                    <Box
                                        sx={{
                                            pl: "20px",
                                            pr: "40px",
                                            position: "relative",
                                            display: "inline-block",
                                        }}
                                    >
                                        <Avatar
                                            src={`${media_url}/${pmChat.profileImagePath}`}
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
                                                        ? "0 0 50px rgba(99,102,241,0.5), 0 0 100px rgba(139,92,246,0.3)"
                                                        : "0 0 50px rgba(99,102,241,0.3), 0 0 100px rgba(139,92,246,0.15)",
                                                },
                                            }}
                                        >
                                            <AccountTreeIcon sx={{ fontSize: 100 }} />
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
                                                title="Edit Profile Image"
                                                variant="outlined"
                                            >
                                                <IconButton
                                                    variant="soft"
                                                    sx={{
                                                        background: isDark
                                                            ? "linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(139,92,246,0.3) 100%)"
                                                            : "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 100%)",
                                                        border: `1px solid ${styles.border}`,
                                                        transition: "all 0.2s ease",
                                                        "&:hover": {
                                                            background: isDark
                                                                ? "linear-gradient(135deg, rgba(99,102,241,0.5) 0%, rgba(139,92,246,0.5) 100%)"
                                                                : "linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.25) 100%)",
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
                                                            color: isDark ? "#a78bfa" : "#7c3aed",
                                                        }}
                                                    />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>

                                    <Stack spacing={2} sx={{ flexGrow: 1 }}>
                                        <Stack direction="column" spacing={1.5}>
                                            <Stack
                                                direction={"row"}
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
                                                        Owner
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
                                                            }}
                                                        >
                                                            {projectProfile
                                                                ? useTEM.teamMemberProfiles[
                                                                      projectProfile?.ownerUserId
                                                                  ]?.userName
                                                                : "N/A"}
                                                        </Typography>
                                                    </Button>
                                                </FormControl>

                                                <Typography
                                                    component="a"
                                                    href={`mailto:${
                                                        projectProfile
                                                            ? useTEM.teamMemberProfiles[
                                                                  projectProfile?.ownerUserId
                                                              ]?.userEmail
                                                            : "N/A"
                                                    }`}
                                                    startDecorator={
                                                        <EmailRoundedIcon
                                                            fontSize="small"
                                                            sx={{
                                                                color: isDark
                                                                    ? "#818cf8"
                                                                    : "#4f46e5",
                                                            }}
                                                        />
                                                    }
                                                    sx={{
                                                        textDecoration: "none",
                                                        color: styles.valueColor,
                                                        cursor: "pointer",
                                                        pb: "8px",
                                                        transition: "all 0.2s ease",
                                                        "&:hover": {
                                                            color: isDark ? "#a78bfa" : "#7c3aed",
                                                        },
                                                    }}
                                                >
                                                    {projectProfile
                                                        ? useTEM.teamMemberProfiles[
                                                              projectProfile?.ownerUserId
                                                          ]?.userEmail
                                                        : "N/A"}
                                                </Typography>
                                            </Stack>

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
                                                        Members ({filteredMembers.length}/
                                                        {projectProfile?.projectMembers?.length ||
                                                            0}
                                                        )
                                                    </FormLabel>
                                                    <Input
                                                        placeholder="Search members..."
                                                        value={memberSearchQuery}
                                                        onChange={(e) =>
                                                            setMemberSearchQuery(e.target.value)
                                                        }
                                                        startDecorator={
                                                            <SearchIcon
                                                                sx={{
                                                                    color: isDark
                                                                        ? "#818cf8"
                                                                        : "#4f46e5",
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
                                                            background: isDark
                                                                ? "rgba(0,0,0,0.3)"
                                                                : "rgba(255,255,255,0.8)",
                                                            border: `1px solid ${styles.border}`,
                                                            fontSize: "14px",
                                                            transition: "all 0.2s ease",
                                                            "&:hover": {
                                                                borderColor: isDark
                                                                    ? "#818cf8"
                                                                    : "#4f46e5",
                                                            },
                                                            "&:focus-within": {
                                                                borderColor: isDark
                                                                    ? "#818cf8"
                                                                    : "#4f46e5",
                                                                boxShadow: isDark
                                                                    ? "0 0 0 2px rgba(99,102,241,0.2)"
                                                                    : "0 0 0 2px rgba(99,102,241,0.1)",
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
                                                            : "rgba(99,102,241,0.03)",
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
                                                                No members found matching "
                                                                {memberSearchQuery}"
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
                                                        Is Private
                                                    </FormLabel>
                                                    <Box
                                                        sx={{
                                                            display: "inline-flex",
                                                            px: 2,
                                                            py: 0.5,
                                                            borderRadius: "20px",
                                                            background: projectProfile?.isPrivate
                                                                ? isDark
                                                                    ? "linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(220,38,38,0.2) 100%)"
                                                                    : "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)"
                                                                : isDark
                                                                  ? "linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(22,163,74,0.2) 100%)"
                                                                  : "linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.15) 100%)",
                                                            border: `1px solid ${
                                                                projectProfile?.isPrivate
                                                                    ? "rgba(239,68,68,0.3)"
                                                                    : "rgba(34,197,94,0.3)"
                                                            }`,
                                                        }}
                                                    >
                                                        <Typography
                                                            fontWeight={600}
                                                            sx={{
                                                                userSelect: "text",
                                                                color: projectProfile?.isPrivate
                                                                    ? isDark
                                                                        ? "#f87171"
                                                                        : "#dc2626"
                                                                    : isDark
                                                                      ? "#4ade80"
                                                                      : "#16a34a",
                                                            }}
                                                        >
                                                            {projectProfile?.isPrivate
                                                                ? "Yes"
                                                                : "No"}
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
                                                        Created Date
                                                    </FormLabel>
                                                    <Box
                                                        sx={{
                                                            display: "inline-flex",
                                                            px: 2,
                                                            py: 0.5,
                                                            borderRadius: "8px",
                                                            background: isDark
                                                                ? "rgba(99,102,241,0.1)"
                                                                : "rgba(99,102,241,0.05)",
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
                                                                : "N/A"}
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
