import { useRef } from "react";
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

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TeamProfileProps, UserProps } from "../../../../types/admin";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";

const base_url = import.meta.env.VITE_API_BASE_URL;
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

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

    // Profile image file upload manager
    const inputRef = useRef<HTMLInputElement | null>(null);
    const handleButtonClick = () => {
        inputRef.current?.click();
    };
    const handleSelectedFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (myself.teamId) {
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
                throw new Error("Failed to upload team profile image.");
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
            <Modal
                open={openModalTeamProfile}
                sx={{ zIndex: 10001 }}
                onClose={() => setOpenModalTeamProfile(false)}
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
                                    Team Profile - {myself.teamName}
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
                                            src={`${media_url}/${teamProfile.teamImgPath}`}
                                            sx={{ width: 180, height: 180, fontSize: "50px" }}
                                        >
                                            <AccountTreeIcon sx={{ fontSize: 100 }} />
                                        </Avatar>

                                        {myself.userId === teamProfile.teamOwnerId && (
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
                                                        onClick={() => {
                                                            handleButtonClick();
                                                        }}
                                                    >
                                                        <EditIcon sx={{ fontSize: "30px" }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        )}
                                    </Box>

                                    <Stack spacing={2} sx={{ flexGrow: 1 }}>
                                        <Stack direction="column" spacing={1}>
                                            <FormControl>
                                                <FormLabel>Team Name</FormLabel>
                                                <Button
                                                    disabled={true}
                                                    variant="plain"
                                                    sx={{
                                                        justifyContent: "flex-start", // left align the content
                                                    }}
                                                >
                                                    <Typography
                                                        fontWeight="bold"
                                                        sx={{ userSelect: "text" }}
                                                    >
                                                        {teamProfile.teamName}
                                                    </Typography>
                                                </Button>
                                            </FormControl>
                                            <FormControl>
                                                <FormLabel>Team ID</FormLabel>
                                                <Button
                                                    disabled={true}
                                                    variant="plain"
                                                    sx={{
                                                        justifyContent: "flex-start", // left align the content
                                                    }}
                                                >
                                                    <Typography
                                                        fontWeight="bold"
                                                        sx={{ userSelect: "text" }}
                                                    >
                                                        {teamProfile.teamId}
                                                    </Typography>
                                                </Button>
                                            </FormControl>
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
                                                            }}
                                                        >
                                                            {
                                                                useTEM.teamMemberProfiles[
                                                                    teamProfile?.teamOwnerId
                                                                ]?.userName
                                                            }
                                                        </Typography>
                                                    </Button>
                                                </FormControl>

                                                <Typography
                                                    component="a"
                                                    href={`mailto:${
                                                        useTEM.teamMemberProfiles[
                                                            teamProfile?.teamOwnerId
                                                        ]?.userEmail
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
                                                    {
                                                        useTEM.teamMemberProfiles[
                                                            teamProfile?.teamOwnerId
                                                        ]?.userEmail
                                                    }
                                                </Typography>
                                            </Stack>

                                            {teamProfile.teamMembers.length > 0 && (
                                                <FormControl>
                                                    <FormLabel>Members</FormLabel>
                                                    <Box
                                                        className="custom-scrollbar"
                                                        sx={{
                                                            maxHeight: "300px",
                                                            overflow: "auto",
                                                        }}
                                                    >
                                                        {teamProfile.teamMembers.map((member) => (
                                                            <ListItemButton
                                                                key={`team-member-${member.userId}`}
                                                                sx={{ ml: 2, my: 0.2 }}
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
                                                        ))}
                                                    </Box>
                                                </FormControl>
                                            )}

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
                                                            {extractYYYYMMDD(
                                                                teamProfile.tsCreatedAt
                                                            )}
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
