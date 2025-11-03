import EditIcon from "@mui/icons-material/Edit";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import GroupsIcon from "@mui/icons-material/Groups";
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
import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, GMProfileProps } from "../../../../types/chat";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { addChat } from "../../services/addChat";
import { loadGMProfile } from "../../services/loadGMProfile";

const base_url = import.meta.env.VITE_API_BASE_URL;
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type ModalGMProfileProps = {
    TEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    gmChat: AllChatProps;
    openModalGMProfile: boolean;
    setOpenModalGMProfile: (value: boolean) => void;
    setAvatarUserId: (value: string) => void;
    setOpenUserProfile: (value: boolean) => void;
    UIM: UIStateManagementState;
    CM: ChatManagementState;
};
export const ModalGMProfile = (props: ModalGMProfileProps) => {
    const {
        TEM,
        myself,
        setMyself,
        socket,
        gmChat,
        openModalGMProfile,
        setOpenModalGMProfile,
        setAvatarUserId,
        setOpenUserProfile,
        UIM,
        CM,
    } = props;

    const { accessToken } = useAuth();

    const [gmProfile, setGmProfile] = useState<GMProfileProps | null>(null);

    // Profile image file upload manager
    const inputRef = useRef<HTMLInputElement | null>(null);
    const handleButtonClick = () => {
        inputRef.current?.click();
    };
    const handleSelectedFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (!selectedFiles || selectedFiles.length !== 1) return;

        const tmpGMProfileImage = selectedFiles[0]; // original File

        // Create a new File instance with the existing file data but new name
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
            throw new Error("Failed to upload user profile image.");
        } else {
            addChat(
                {
                    ...gmChat,
                    profileImagePath: uploadProfileImageData.profile_image_file_name,
                },
                gmChat.chatType
            );
            await CM.funcSetAllChats();
        }
    };

    const loadGMProfileData = async () => {
        const gmProfile = await loadGMProfile(myself.teamId, gmChat.chatId, accessToken);
        setGmProfile(gmProfile);
    };
    useEffect(() => {
        loadGMProfileData();
    }, [openModalGMProfile]);

    return (
        <>
            <Modal
                open={openModalGMProfile}
                sx={{ zIndex: 10001 }}
                onClose={() => setOpenModalGMProfile(false)}
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
                                    GM Profile - {gmChat.chatName}
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
                                            src={`${media_url}/${gmChat.profileImagePath}`}
                                            sx={{ width: 180, height: 180, fontSize: "50px" }}
                                        >
                                            <GroupsIcon sx={{ fontSize: 100 }} />
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
                                                variant="outlined"
                                            >
                                                <IconButton
                                                    variant="soft"
                                                    onClick={handleButtonClick}
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
                                                            }}
                                                        >
                                                            {gmProfile
                                                                ? TEM.teamMemberProfiles[
                                                                      gmProfile?.ownerUserId
                                                                  ]?.userName
                                                                : "N/A"}
                                                        </Typography>
                                                    </Button>
                                                </FormControl>

                                                <Typography
                                                    component="a"
                                                    href={`mailto:${
                                                        gmProfile
                                                            ? TEM.teamMemberProfiles[
                                                                  gmProfile?.ownerUserId
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
                                                    {gmProfile
                                                        ? TEM.teamMemberProfiles[
                                                              gmProfile?.ownerUserId
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
                                                    {gmProfile?.gmMembers.map((member) => (
                                                        <ListItemButton sx={{ ml: 2, my: 0.2 }}>
                                                            <AvatarWithStatus
                                                                avatarUser={member}
                                                                CM={CM}
                                                                isYou={false}
                                                                myself={myself}
                                                                setMyself={setMyself}
                                                                showNameAndEmail={true}
                                                                socket={socket}
                                                                UIM={UIM}
                                                            />
                                                        </ListItemButton>
                                                    ))}
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
                                                            {gmProfile?.isPrivate ? "Yes" : "No"}
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
                                                            {gmProfile?.tsCreatedAt
                                                                ? extractYYYYMMDD(
                                                                      gmProfile.tsCreatedAt
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
