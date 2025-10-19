import { useEffect, useRef, useState } from "react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import EditIcon from "@mui/icons-material/Edit";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import {
    Avatar,
    Box,
    Button,
    Card,
    FormControl,
    FormLabel,
    IconButton,
    ListItemButton,
    Modal,
    ModalDialog,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";
import { useAuth } from "../../../../context/AuthContext";
import { loadProjectProfile } from "../../../../services/loadProjectProfile";
import { ProjectProfileProps, UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { addChat } from "../../../chat/services/addChat";

const base_url = import.meta.env.VITE_API_BASE_URL;
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type ModalProjectProfileProps = {
    socket: Socket | null;
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    pmChat: AllChatProps;
    openModalProjectProfile: boolean;
    setOpenModalProjectProfile: (value: boolean) => void;
    funcSetAllChats: () => Promise<void>;
    setAvatarUserId: (value: string) => void;
    setOpenUserProfile: (value: boolean) => void;
    setCurrentMainChat: (value: ChatProps) => void;
    setOpeningService: (value: number) => void;
};
export const ModalProjectProfile = (props: ModalProjectProfileProps) => {
    const {
        socket,
        teamMemberProfiles,
        myself,
        setMyself,
        pmChat,
        openModalProjectProfile,
        setOpenModalProjectProfile,
        funcSetAllChats,
        setAvatarUserId,
        setOpenUserProfile,
        setCurrentMainChat,
        setOpeningService,
    } = props;

    const { accessToken } = useAuth();

    const [projectProfile, setProjectProfile] = useState<ProjectProfileProps | null>(null);

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
                await funcSetAllChats();
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
                sx={{ zIndex: 10001 }}
                onClose={() => setOpenModalProjectProfile(false)}
            >
                <ModalDialog>
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
                                <Typography component="h1" level="h2" sx={{ mt: 1, mb: 1 }}>
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
                            <Card>
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
                                            sx={{ width: 180, height: 180, fontSize: "50px" }}
                                        >
                                            <AccountTreeIcon sx={{ fontSize: 100 }} />
                                        </Avatar>

                                        <Box
                                            sx={{
                                                position: "absolute",
                                                top: 150, // adjust vertical position
                                                right: 30, // push it to the right side
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
                                                title="EDIT (TBD)"
                                            >
                                                <IconButton
                                                    variant="soft"
                                                    onClick={() => {
                                                        if (pmChat.project) {
                                                            handleButtonClick();
                                                        } else {
                                                            console.error("Project not found");
                                                        }
                                                    }}
                                                >
                                                    <EditIcon sx={{ fontSize: "30px" }} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>

                                    <Stack spacing={2} sx={{ flexGrow: 1 }}>
                                        <Stack direction="column" spacing={1}>
                                            <Stack direction={"row"}>
                                                <FormControl>
                                                    <FormLabel>Owner</FormLabel>
                                                    <Button
                                                        color="neutral"
                                                        variant="plain"
                                                        sx={{
                                                            justifyContent: "flex-start", // left align the content
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
                                                            }}
                                                        >
                                                            {projectProfile
                                                                ? teamMemberProfiles[
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
                                                            ? teamMemberProfiles[
                                                                  projectProfile?.ownerUserId
                                                              ]?.userEmail
                                                            : "N/A"
                                                    }`}
                                                    startDecorator={
                                                        <EmailRoundedIcon fontSize="small" />
                                                    }
                                                    sx={{
                                                        textDecoration: "none",
                                                        color: "inherit",
                                                        cursor: "pointer",
                                                        pt: "28px",
                                                    }}
                                                >
                                                    {projectProfile
                                                        ? teamMemberProfiles[
                                                              projectProfile?.ownerUserId
                                                          ]?.userEmail
                                                        : "N/A"}
                                                </Typography>
                                            </Stack>

                                            <Box
                                                className="custom-scrollbar"
                                                sx={{ maxHeight: "300px", overflow: "auto" }}
                                            >
                                                <FormControl>
                                                    <FormLabel>Members</FormLabel>
                                                    {projectProfile?.projectMembers.map(
                                                        (member) => (
                                                            <ListItemButton
                                                                sx={{ ml: 2, my: 0.2 }}
                                                            >
                                                                <AvatarWithStatus
                                                                    avatarUser={member}
                                                                    isYou={false}
                                                                    myself={myself}
                                                                    setMyself={setMyself}
                                                                    showNameAndEmail={true}
                                                                    socket={socket}
                                                                    setCurrentMainChat={
                                                                        setCurrentMainChat
                                                                    }
                                                                    setOpeningService={
                                                                        setOpeningService
                                                                    }
                                                                />
                                                            </ListItemButton>
                                                        )
                                                    )}
                                                </FormControl>
                                            </Box>

                                            <Stack direction="column" spacing={2}>
                                                <FormControl>
                                                    <FormLabel>Is Private</FormLabel>
                                                    <Button
                                                        disabled={true}
                                                        variant="plain"
                                                        sx={{
                                                            justifyContent: "flex-start", // left align the content
                                                        }}
                                                    >
                                                        <Typography
                                                            fontWeight={"bold"}
                                                            sx={{ userSelect: "text" }}
                                                        >
                                                            {projectProfile?.isPrivate
                                                                ? "Yes"
                                                                : "No"}
                                                        </Typography>
                                                    </Button>
                                                </FormControl>
                                            </Stack>

                                            <Stack direction="column" spacing={2}>
                                                <FormControl>
                                                    <FormLabel>Created Date</FormLabel>
                                                    <Button
                                                        disabled={true}
                                                        variant="plain"
                                                        sx={{
                                                            justifyContent: "flex-start", // left align the content
                                                        }}
                                                    >
                                                        <Typography
                                                            fontWeight={"bold"}
                                                            sx={{ userSelect: "text" }}
                                                        >
                                                            {projectProfile?.tsCreatedAt
                                                                ? extractYYYYMMDD(
                                                                      projectProfile.tsCreatedAt
                                                                  )
                                                                : "N/A"}
                                                        </Typography>
                                                    </Button>
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
