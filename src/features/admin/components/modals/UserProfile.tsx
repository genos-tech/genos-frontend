import { Socket } from "socket.io-client";
import { useState, useEffect, useRef } from "react";
import {
    Modal,
    ModalDialog,
    Avatar,
    Box,
    FormControl,
    FormLabel,
    Button,
    IconButton,
    Stack,
    Typography,
    Card,
    Tooltip,
} from "@mui/joy";
import EditIcon from "@mui/icons-material/Edit";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LocalPhoneIcon from "@mui/icons-material/LocalPhone";
import PhoneInTalkRoundedIcon from "@mui/icons-material/PhoneInTalkRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";

import { moveToDMChat } from "../../../chat/services/moveToChat";
import { loadDMIdByUserId } from "../../../chat/services/loadDMIdByUserId";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";
import { UserProfileBaseCountry } from "./sub/UserProfileBaseCountry";
import { useAuth } from "../../../../context/AuthContext";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { EmojiPicker } from "../../../../components/emojiInput/EmojiPicker";
import { UserProfileStatus } from "./sub/UserProfileStatus";
import { UserProfileRole } from "./sub/UserProfileRole";

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
        formData.append(
            "user_profile_image_file_name",
            `user_profiles/${myself.userId}/${userProfileImage.name}`
        );

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
                onClose={() => setOpenUserProfile(false)}
                sx={{ zIndex: 10001 }}
            >
                <ModalDialog>
                    <Box sx={{ flex: 1, width: "1000px" }}>
                        <EmojiPicker
                            showEmojiPicker={showEmojiPicker}
                            setShowEmojiPicker={setShowEmojiPicker}
                            setSelectedEmoji={setSelectedEmoji}
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
                                <Typography level="h2" component="h1" sx={{ mt: 1, mb: 1 }}>
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
                                            sx={{ width: 180, height: 180, fontSize: "50px" }}
                                            onClick={() => setOpenUserProfile(true)}
                                            src={`${media_url}/${profileUser?.avatarImgPath}`}
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
                                                    type="file"
                                                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                                    multiple={false}
                                                    ref={inputRef}
                                                    onChange={handleSelectedFiles}
                                                    style={{ display: "none" }}
                                                />
                                                <Tooltip title="EDIT (TBD)" sx={{ zIndex: 9000 }}>
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
                                            myself={myself}
                                            setMyself={setMyself}
                                            isYou={isYou}
                                            user={user}
                                            setShowEmojiPicker={setShowEmojiPicker}
                                            selectedEmoji={selectedEmoji}
                                            setSelectedEmoji={setSelectedEmoji}
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
                                                startDecorator={
                                                    <LocalPhoneIcon fontSize="small" />
                                                }
                                                sx={{ userSelect: "text" }}
                                            >
                                                +81 999-888-777
                                            </Typography>
                                        </Stack>
                                        <Stack direction="column" spacing={1}>
                                            <FormControl>
                                                <FormLabel>Team Name</FormLabel>
                                                <Button
                                                    variant="plain"
                                                    sx={{
                                                        justifyContent: "flex-start", // left align the content
                                                    }}
                                                    disabled={true}
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
                                                    variant="plain"
                                                    sx={{
                                                        justifyContent: "flex-start", // left align the content
                                                    }}
                                                    disabled={true}
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
                                                <FormLabel>Since Joined</FormLabel>
                                                <Button
                                                    variant="plain"
                                                    sx={{
                                                        justifyContent: "flex-start", // left align the content
                                                    }}
                                                    disabled={true}
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
                                variant="outlined"
                                size="sm"
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
                                            localStorage.setItem("openingService", "1");
                                            setOpenUserProfile(false);
                                        }
                                    })();
                                }}
                            >
                                <QuestionAnswerRoundedIcon />
                                &nbsp;DM
                            </IconButton>
                            <IconButton
                                component="button"
                                variant="outlined"
                                size="sm"
                                sx={{
                                    fontSize: "16px",
                                    paddingX: "7px",
                                    paddingY: "3px",
                                    ml: 1,
                                }}
                                onClick={() => {
                                    setOpenUserProfile(false);
                                }}
                            >
                                <PhoneInTalkRoundedIcon />
                                &nbsp;Call (TBD)
                            </IconButton>
                        </Box>
                    </Box>
                </ModalDialog>
            </Modal>
        </>
    );
};
