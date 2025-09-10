import { Socket } from "socket.io-client";
import { useState } from "react";
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

type UserProfileProps = {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
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
        user,
        openUserProfile,
        setOpenUserProfile,
        setCurrentMainChat,
        setOpeningService,
    } = props;

    const { accessToken } = useAuth();
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);

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
                                    {myself.userId !== user?.userId
                                        ? user?.userName
                                            ? `${user?.userName}'s Profile`
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
                                            src={user?.avatarImgPath}
                                        >
                                            {user?.userName[0]}
                                        </Avatar>

                                        {myself.userId === user?.userId && (
                                            <Box
                                                sx={{
                                                    position: "absolute",
                                                    top: 150, // adjust vertical position
                                                    right: 30, // push it to the right side
                                                }}
                                            >
                                                <Tooltip title="EDIT (TBD)" sx={{ zIndex: 10001 }}>
                                                    <IconButton variant="soft">
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
                                            user={user}
                                            setShowEmojiPicker={setShowEmojiPicker}
                                            selectedEmoji={selectedEmoji}
                                            setSelectedEmoji={setSelectedEmoji}
                                        />

                                        <Stack direction={"row"} spacing={2}>
                                            <Typography
                                                component="a"
                                                href={`mailto:${user?.userEmail}`}
                                                startDecorator={
                                                    <EmailRoundedIcon fontSize="small" />
                                                }
                                                sx={{
                                                    textDecoration: "none",
                                                    color: "inherit",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {user?.userEmail}
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
                                                        {user?.teamName}
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
                                                        {user?.teamId}
                                                    </Typography>
                                                </Button>
                                            </FormControl>
                                            <FormControl>
                                                <FormLabel>Role</FormLabel>
                                                <UserProfileRole
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    user={user}
                                                />
                                            </FormControl>
                                            <FormControl>
                                                <FormLabel>Country</FormLabel>
                                                <UserProfileBaseCountry
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    user={user}
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
                                                        {user &&
                                                        user?.tsJoined !== "" &&
                                                        user?.tsJoined !== "N/A"
                                                            ? extractYYYYMMDD(user.tsJoined)
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
                                        if (user) {
                                            const chatId: number = await loadDMIdByUserId(
                                                myself,
                                                user?.userId,
                                                accessToken
                                            );
                                            await moveToDMChat(
                                                socket,
                                                chatId,
                                                user?.userName,
                                                user,
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
