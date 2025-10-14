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
import { Socket } from "socket.io-client";

import { EmojiPicker } from "../../../../components/emojiInput/EmojiPicker";
import { useAuth } from "../../../../context/AuthContext";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { loadDMIdByUserId } from "../../../chat/services/loadDMIdByUserId";
import { moveToDMChat } from "../../../chat/services/moveToChat";
import { UserProfileBaseCountry } from "./sub/UserProfileBaseCountry";
import { UserProfileRole } from "./sub/UserProfileRole";
import { UserProfileStatus } from "./sub/UserProfileStatus";

const base_url = import.meta.env.VITE_API_BASE_URL;
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type UserProfileProps = {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    isYou: boolean;
    user?: UserProps;
    openUserProfile: boolean;
    setOpenUserProfile: (value: boolean) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
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
        setCurrentMainChat,
        setOpeningService,
    } = props;

    const { accessToken } = useAuth();
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

        const tmpUserProfileImage = selectedFiles[0]; // original File

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
            localStorage.setItem("avatarImgPath", uploadProfileImageData.profile_image_file_name);
            setMyself({
                ...myself,
                avatarImgPath: uploadProfileImageData.profile_image_file_name,
            });
        }
    };

    return (
        <>
            <Modal
                open={openUserProfile}
                sx={{ zIndex: 10001 }}
                onClose={() => setOpenUserProfile(false)}
            >
                <ModalDialog>
                    <Box sx={{ flex: 1, width: "1000px" }}>
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
                                <Typography component="h1" level="h2" sx={{ mt: 1, mb: 1 }}>
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
                                            src={`${media_url}/${profileUser?.avatarImgPath}`}
                                            sx={{ width: 180, height: 180, fontSize: "50px" }}
                                            onClick={() => setOpenUserProfile(true)}
                                        >
                                            {profileUser?.userName[0]}
                                        </Avatar>

                                        {myself.userId === profileUser?.userId && (
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
                                                <Tooltip sx={{ zIndex: 9000 }} title="EDIT (TBD)">
                                                    <IconButton
                                                        variant="soft"
                                                        onClick={handleButtonClick}
                                                    >
                                                        <EditIcon sx={{ fontSize: "30px" }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        )}
                                    </Box>

                                    <Stack spacing={2} sx={{ flexGrow: 1 }}>
                                        <UserProfileStatus
                                            isYou={isYou}
                                            myself={myself}
                                            selectedEmoji={selectedEmoji}
                                            setMyself={setMyself}
                                            setSelectedEmoji={setSelectedEmoji}
                                            setShowEmojiPicker={setShowEmojiPicker}
                                            user={user}
                                        />

                                        <Stack direction={"row"} spacing={2}>
                                            <Typography
                                                component="a"
                                                href={`mailto:${profileUser?.userEmail}`}
                                                startDecorator={
                                                    <EmailRoundedIcon fontSize="small" />
                                                }
                                                sx={{
                                                    textDecoration: "none",
                                                    color: "inherit",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {profileUser?.userEmail}
                                            </Typography>
                                            <Typography
                                                sx={{ userSelect: "text" }}
                                                startDecorator={
                                                    <LocalPhoneIcon fontSize="small" />
                                                }
                                            >
                                                +81 999-888-777
                                            </Typography>
                                        </Stack>
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
                                                        {profileUser?.teamName}
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
                                                        {profileUser?.teamId}
                                                    </Typography>
                                                </Button>
                                            </FormControl>
                                            <FormControl>
                                                <FormLabel>User ID</FormLabel>
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
                                                        {profileUser?.userId}
                                                    </Typography>
                                                </Button>
                                            </FormControl>
                                            <FormControl>
                                                <FormLabel>Role</FormLabel>
                                                <UserProfileRole
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    user={profileUser}
                                                />
                                            </FormControl>
                                            <FormControl>
                                                <FormLabel>Country</FormLabel>
                                                <UserProfileBaseCountry
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    user={profileUser}
                                                />
                                            </FormControl>
                                        </Stack>
                                        <Stack direction="column" spacing={2}>
                                            <FormControl>
                                                <FormLabel>Joined Date</FormLabel>
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
                                                        {profileUser &&
                                                        profileUser?.tsJoined !== "" &&
                                                        profileUser?.tsJoined !== "N/A"
                                                            ? extractYYYYMMDD(profileUser.tsJoined)
                                                            : "N/A"}
                                                    </Typography>
                                                </Button>
                                            </FormControl>
                                        </Stack>
                                    </Stack>
                                </Stack>
                            </Card>
                        </Stack>
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "flex-end", // Push content to the right
                                px: 3,
                            }}
                        >
                            <IconButton
                                component="button"
                                size="sm"
                                variant="outlined"
                                sx={{
                                    fontSize: "16px",
                                    paddingX: "7px",
                                    paddingY: "3px",
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
                                                setCurrentMainChat
                                            );
                                            setOpeningService(1);
                                            setOpenUserProfile(false);
                                        }
                                    })();
                                }}
                            >
                                <QuestionAnswerRoundedIcon />
                                &nbsp;DM
                            </IconButton>
                        </Box>
                    </Box>
                </ModalDialog>
            </Modal>
        </>
    );
};
