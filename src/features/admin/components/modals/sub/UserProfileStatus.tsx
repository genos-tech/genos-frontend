import { useEffect, useState } from "react";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import {
    Box,
    Button,
    Chip,
    Dropdown,
    IconButton,
    Input,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Typography,
} from "@mui/joy";

import { PulseDot } from "../../../../../components/utils/PulseDot";
import { useAuth } from "../../../../../context/AuthContext";
import { UserProps } from "../../../../../types/admin";
import { updateUserProfile } from "../../../services/updateUserProfile";

const templateCustomStatueOptions = [
    "🧠 In the Zone",
    "💨 AFK",
    "☕ Coffee Break",
    "🥪 Enjoying Lunch",
    "🌴 On Holiday",
    "🚋 Commuting",
    "🤒 Off Sick",
    "✈️ Traveling",
    "🏢 WFO",
    "🏡 WFH",
    "⛔ OOO",
    "🚫 Do Not Disturb",
];

type UserProfileStatusProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    isYou: boolean;
    user?: UserProps;
    setShowEmojiPicker: (value: boolean) => void;
    selectedEmoji: any;
    setSelectedEmoji: (value: any) => void;
};
export const UserProfileStatus = (props: UserProfileStatusProps) => {
    const { myself, setMyself, isYou, user, setShowEmojiPicker, selectedEmoji, setSelectedEmoji } =
        props;
    const { accessToken } = useAuth();

    const [profileUser, setProfileUser] = useState<UserProps | undefined>(
        isYou === true ? myself : user
    );
    useEffect(() => {
        if (isYou === true) {
            setProfileUser(myself);
        } else {
            setProfileUser(user);
        }
    }, [user]);

    const [openCustomStatusEditor, setOpenCustomStatusEditor] = useState(false);
    const [isStatusUpdated, setIsStatusUpdated] = useState(false);
    const [newStatus, setNewStatus] = useState("");
    const [customStatusValue, setCustomStatusValue] = useState(
        profileUser ? profileUser.customStatus : "Update Status"
    );
    useEffect(() => {
        if (isStatusUpdated === false && openCustomStatusEditor === false) {
            setCustomStatusValue(profileUser ? profileUser.customStatus : "Update Status");
        }
    }, [profileUser, isStatusUpdated]);

    const insertEmoji = (emoji: any) => {
        setNewStatus(emoji + " " + newStatus);
        setSelectedEmoji(null);
    };
    useEffect(() => {
        if (selectedEmoji !== null) {
            insertEmoji(selectedEmoji);
        }
    }, [selectedEmoji]);

    return (
        <Stack direction={"column"}>
            <Typography
                component="div"
                fontSize={28}
                fontWeight="bold"
                endDecorator={
                    <Stack direction={"row"} spacing={0.5}>
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
                                <Chip
                                    color="neutral"
                                    size="md"
                                    variant="plain"
                                    slotProps={{
                                        root: {
                                            component: "span",
                                        },
                                    }}
                                    startDecorator={
                                        <Box sx={{ ml: "-5px" }}>
                                            <PulseDot
                                                color={
                                                    myself.userId === profileUser?.userId
                                                        ? myself?.isOfflineForced !== "true"
                                                            ? "#4caf50"
                                                            : "#999"
                                                        : profileUser?.isOnline === true &&
                                                            profileUser?.isOfflineForced !== "true"
                                                          ? "#4caf50"
                                                          : "#999"
                                                }
                                            />
                                        </Box>
                                    }
                                    sx={{
                                        borderRadius: "sm",
                                        fontSize: "16px",
                                    }}
                                >
                                    {myself.userId === profileUser?.userId
                                        ? myself?.isOfflineForced !== "true"
                                            ? "Online"
                                            : "Offline (Forced)"
                                        : profileUser?.isOnline === true &&
                                            profileUser?.isOfflineForced !== "true"
                                          ? "Online"
                                          : "Offline"}
                                </Chip>
                            </MenuButton>
                            {myself.userId === profileUser?.userId && (
                                <Menu sx={{ zIndex: 10010 }}>
                                    <MenuItem
                                        onClick={() => {
                                            updateUserProfile({
                                                accessToken: accessToken,
                                                userId: myself.userId,
                                                isOfflineForced: "false",
                                            });
                                            setMyself({
                                                ...myself,
                                                isOfflineForced: "false",
                                            });
                                            localStorage.setItem("isOfflineForced", "false");
                                        }}
                                    >
                                        <PulseDot color={"#4caf50"} />
                                        Set Online
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => {
                                            updateUserProfile({
                                                accessToken: accessToken,
                                                userId: myself.userId,
                                                isOfflineForced: "true",
                                            });
                                            setMyself({
                                                ...myself,
                                                isOfflineForced: "true",
                                            });
                                            localStorage.setItem("isOfflineForced", "true");
                                        }}
                                    >
                                        <PulseDot color={"#999"} />
                                        Set Always Offline
                                    </MenuItem>
                                </Menu>
                            )}
                        </Dropdown>

                        {myself.userId === profileUser?.userId && (
                            <>
                                {openCustomStatusEditor === false && (
                                    <Chip
                                        color="neutral"
                                        size="lg"
                                        sx={{ borderRadius: "sm" }}
                                        variant="outlined"
                                        onClick={() => {
                                            setOpenCustomStatusEditor(true);
                                        }}
                                    >
                                        {myself.customStatus !== ""
                                            ? myself.customStatus
                                            : "Update Status"}
                                    </Chip>
                                )}
                            </>
                        )}

                        {myself.userId !== profileUser?.userId && (
                            <>
                                {openCustomStatusEditor === false && (
                                    <Chip
                                        color="neutral"
                                        size="lg"
                                        sx={{ borderRadius: "sm" }}
                                        variant="outlined"
                                        onClick={() => {}}
                                    >
                                        {customStatusValue !== "Update Status" &&
                                        customStatusValue != ""
                                            ? customStatusValue
                                            : "Update Status"}
                                    </Chip>
                                )}
                            </>
                        )}

                        {/* Update custom status */}
                        {openCustomStatusEditor === true && (
                            <Stack direction={"row"} justifyContent={"center"} spacing={0.5}>
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
                                        {templateCustomStatueOptions.map((template, idx) => (
                                            <MenuItem
                                                key={idx}
                                                onClick={() => {
                                                    setNewStatus(template);
                                                }}
                                            >
                                                {template}
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                </Dropdown>
                                <Input
                                    placeholder="Set your status…"
                                    size="sm"
                                    sx={{ width: "200px" }}
                                    value={newStatus}
                                    variant="outlined"
                                    onChange={(e) => setNewStatus(e.target.value)}
                                />
                            </Stack>
                        )}
                    </Stack>
                }
                noWrap
            >
                {profileUser?.userName}
            </Typography>
            {openCustomStatusEditor === true && (
                <Stack direction={"row"} justifyContent={"center"} spacing={0.5}>
                    <Button
                        color="danger"
                        size="md"
                        variant="outlined"
                        sx={{
                            borderRadius: "sm",
                            fontWeight: "bold",
                        }}
                        onClick={() => {
                            setOpenCustomStatusEditor(false);
                            setIsStatusUpdated(true);
                            setCustomStatusValue("Update Status");
                            setNewStatus("");
                            updateUserProfile({
                                accessToken: accessToken,
                                userId: myself.userId,
                                customStatus: "",
                            });
                            setMyself({
                                ...myself,
                                customStatus: "",
                            });
                            localStorage.setItem("customStatus", "");
                        }}
                    >
                        RESET
                    </Button>
                    <Button
                        color="neutral"
                        size="md"
                        variant="outlined"
                        sx={{
                            borderRadius: "sm",
                            fontWeight: "bold",
                        }}
                        onClick={() => {
                            setOpenCustomStatusEditor(false);
                        }}
                    >
                        CANCEL
                    </Button>
                    <Button
                        color="primary"
                        size="md"
                        variant="soft"
                        sx={{
                            borderRadius: "sm",
                            fontWeight: "bold",
                        }}
                        onClick={() => {
                            if (newStatus && newStatus !== "") {
                                setCustomStatusValue(newStatus);
                                updateUserProfile({
                                    accessToken: accessToken,
                                    userId: myself.userId,
                                    customStatus: newStatus,
                                });
                                setMyself({
                                    ...myself,
                                    customStatus: newStatus,
                                });
                                localStorage.setItem("customStatus", newStatus);
                                setIsStatusUpdated(true);
                            }
                            setOpenCustomStatusEditor(false);
                        }}
                    >
                        SET
                    </Button>
                </Stack>
            )}
        </Stack>
    );
};
