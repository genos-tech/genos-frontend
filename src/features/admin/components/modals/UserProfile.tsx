import { Socket } from "socket.io-client";
import { useState, useEffect } from "react";
import {
    Modal,
    ModalDialog,
    Avatar,
    Box,
    FormControl,
    FormLabel,
    IconButton,
    Stack,
    Typography,
    Card,
    Chip,
    Dropdown,
    Input,
    Menu,
    MenuItem,
    MenuButton,
} from "@mui/joy";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import EditIcon from "@mui/icons-material/Edit";
import LocalPhoneIcon from "@mui/icons-material/LocalPhone";
import PhoneInTalkRoundedIcon from "@mui/icons-material/PhoneInTalkRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";

import { moveToDMChat } from "../../../chat/services/moveToChat";
import { loadDMIdByUserId } from "../../../chat/services/loadDMIdByUserId";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";
import { CountrySelector } from "../../../../components/utils/CountrySelector";
import { useAuth } from "../../../../context/AuthContext";
import { PulseDot } from "../../../../components/utils/PulseDot";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { EmojiPicker } from "../../../../components/emojiInput/EmojiPicker";

const templateCustomStatueOptions = [
    "⛔ OOO",
    "🚫 Do Not Disturb",
    "🏖️ On Holiday",
    "🥪 Enjoying Lunch",
];

type UserProfileProps = {
    socket: Socket | null;
    myself: UserProps;
    user?: UserProps;
    openUserProfile: boolean;
    setOpenUserProfile: (value: boolean) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
};
export const UserProfile = (props: UserProfileProps) => {
    const {
        socket,
        myself,
        user,
        openUserProfile,
        setOpenUserProfile,
        setCurrentMainChat,
        setOpeningService,
    } = props;

    const { accessToken } = useAuth();
    const [openCustomStatusEditor, setOpenCustomStatusEditor] = useState(false);
    const [isStatusUpdated, setIsStatusUpdated] = useState(false);
    const [customStatusValue, setCustomStatusValue] = useState(
        user && user.customStatus !== "" && user.customStatus !== "undefined"
            ? user.customStatus
            : "Custom your status"
    );

    useEffect(() => {
        if (isStatusUpdated === false) {
            if (user && user.customStatus !== "" && user.customStatus !== "undefined") {
                setCustomStatusValue(user.customStatus);
            } else {
                setCustomStatusValue("Custom your status");
            }
        }
    }, [user, isStatusUpdated]);

    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const insertEmoji = (emoji: any) => {
        setCustomStatusValue(emoji + " " + customStatusValue);
        setSelectedEmoji(null);
    };
    useEffect(() => {
        if (selectedEmoji !== null) {
            insertEmoji(selectedEmoji);
        }
    }, [selectedEmoji]);

    if (openUserProfile === true) {
        console.log("user:", user);
    }

    return (
        <>
            <Modal
                open={openUserProfile}
                onClose={() => setOpenUserProfile(false)}
                sx={{ zIndex: 10001 }}
            >
                <ModalDialog>
                    <Box sx={{ flex: 1, width: "900px" }}>
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
                                    My profile
                                </Typography>
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
                                        setOpenUserProfile(false);
                                    }}
                                >
                                    <EditIcon />
                                    &nbsp;Edit (TBD)
                                </IconButton>
                            </Box>
                        </Box>

                        <Stack
                            spacing={4}
                            sx={{
                                display: "flex",
                                maxWidth: "800px",
                                mx: "auto",
                                px: { xs: 2, md: 6 },
                                py: { xs: 2, md: 3 },
                            }}
                        >
                            <Card>
                                <Stack
                                    direction="row"
                                    spacing={3}
                                    sx={{ display: { xs: "none", md: "flex" }, my: 1 }}
                                >
                                    <Avatar
                                        sx={{ width: 100, height: 100, fontSize: "50px" }}
                                        onClick={() => setOpenUserProfile(true)}
                                        src={user?.avatarImgPath}
                                    >
                                        {user?.userName[0]}
                                    </Avatar>
                                    <Stack spacing={2} sx={{ flexGrow: 1 }}>
                                        <Typography
                                            component="div"
                                            fontSize={28}
                                            fontWeight="bold"
                                            noWrap
                                            endDecorator={
                                                <Stack direction={"row"} spacing={1}>
                                                    <Chip
                                                        variant="outlined"
                                                        size="lg"
                                                        color="neutral"
                                                        sx={{ borderRadius: "sm" }}
                                                        startDecorator={
                                                            <Box sx={{ ml: "-5px" }}>
                                                                <PulseDot
                                                                    color={
                                                                        user?.isOnline === true
                                                                            ? "#4caf50"
                                                                            : "#999"
                                                                    }
                                                                />
                                                            </Box>
                                                        }
                                                        slotProps={{ root: { component: "span" } }}
                                                    >
                                                        {user?.isOnline === true
                                                            ? "Online"
                                                            : "Offline"}
                                                    </Chip>
                                                    {openCustomStatusEditor === false && (
                                                        <Chip
                                                            variant="outlined"
                                                            size="lg"
                                                            color="neutral"
                                                            sx={{ borderRadius: "sm" }}
                                                            onClick={() => {
                                                                setOpenCustomStatusEditor(true);
                                                            }}
                                                        >
                                                            {customStatusValue}
                                                        </Chip>
                                                    )}
                                                    {openCustomStatusEditor === true && (
                                                        <Stack direction={"row"} spacing={0}>
                                                            <IconButton
                                                                variant="outlined"
                                                                onClick={() => {
                                                                    setShowEmojiPicker(true);
                                                                }}
                                                            >
                                                                <SentimentSatisfiedAltIcon />
                                                            </IconButton>
                                                            <Dropdown>
                                                                <MenuButton
                                                                    slots={{ root: IconButton }}
                                                                    slotProps={{
                                                                        root: {
                                                                            variant: "outlined",
                                                                            color: "neutral",
                                                                        },
                                                                    }}
                                                                >
                                                                    <ArrowDropDown />
                                                                </MenuButton>
                                                                <Menu sx={{ zIndex: 10010 }}>
                                                                    {templateCustomStatueOptions.map(
                                                                        (template, idx) => (
                                                                            <MenuItem
                                                                                key={idx}
                                                                                onClick={() => {
                                                                                    setCustomStatusValue(
                                                                                        template
                                                                                    );
                                                                                }}
                                                                            >
                                                                                {template}
                                                                            </MenuItem>
                                                                        )
                                                                    )}
                                                                </Menu>
                                                            </Dropdown>
                                                            <Input
                                                                size="md"
                                                                placeholder="Set you status…"
                                                                variant="outlined"
                                                                value={customStatusValue}
                                                                onChange={(e) =>
                                                                    setCustomStatusValue(
                                                                        e.target.value
                                                                    )
                                                                }
                                                            />
                                                            <Chip
                                                                variant="solid"
                                                                size="md"
                                                                color="neutral"
                                                                sx={{
                                                                    borderRadius: "sm",
                                                                    fontWeight: "bold",
                                                                }}
                                                                onClick={() => {
                                                                    setOpenCustomStatusEditor(
                                                                        false
                                                                    );
                                                                    setIsStatusUpdated(true);
                                                                }}
                                                            >
                                                                SET
                                                            </Chip>
                                                        </Stack>
                                                    )}
                                                </Stack>
                                            }
                                        >
                                            {user?.userName}
                                        </Typography>
                                        <Stack direction={"row"} spacing={2}>
                                            <Typography
                                                startDecorator={
                                                    <EmailRoundedIcon fontSize="small" />
                                                }
                                            >
                                                {user?.userEmail}
                                            </Typography>
                                            <Typography
                                                startDecorator={
                                                    <LocalPhoneIcon fontSize="small" />
                                                }
                                            >
                                                +81 999-888-777
                                            </Typography>
                                        </Stack>
                                        <Stack direction="column" spacing={2}>
                                            <Stack direction={"row"} spacing={2}>
                                                <FormControl>
                                                    <FormLabel>Team Name</FormLabel>
                                                    <Typography fontWeight={"bold"}>
                                                        {user?.teamName}
                                                    </Typography>
                                                </FormControl>
                                                <FormControl>
                                                    <FormLabel>Team ID</FormLabel>
                                                    <Typography fontWeight={"bold"}>
                                                        {user?.teamId}
                                                    </Typography>
                                                </FormControl>
                                            </Stack>
                                            <FormControl>
                                                <FormLabel>Role (TBD to Edit)</FormLabel>
                                                <Typography fontWeight={"bold"}>
                                                    Data Engineer
                                                </Typography>
                                            </FormControl>
                                            <FormControl>
                                                <FormLabel>Country</FormLabel>
                                                <CountrySelector />
                                            </FormControl>
                                        </Stack>
                                        <Stack direction="column" spacing={2}>
                                            <FormControl>
                                                <FormLabel>Joined since</FormLabel>
                                                <Typography fontWeight={"bold"}>
                                                    {user &&
                                                    user?.tsJoined !== "" &&
                                                    user?.tsJoined !== "N/A"
                                                        ? extractYYYYMMDD(user.tsJoined)
                                                        : "N/A"}
                                                </Typography>
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
                                                user,
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
