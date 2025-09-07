import { useState, useEffect } from "react";
import {
    Box,
    IconButton,
    Stack,
    Typography,
    Chip,
    Dropdown,
    Input,
    Menu,
    MenuItem,
    MenuButton,
} from "@mui/joy";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";

import { PulseDot } from "../../../../../components/utils/PulseDot";
import { UserProps } from "../../../../../types/admin";
import { updateUserProfile } from "../../../services/updateUserProfile";
import { useAuth } from "../../../../../context/AuthContext";

const templateCustomStatueOptions = [
    "💨 AFK",
    "☕ Coffee Break",
    "🧠 In the Zone",
    "🏖️ On Holiday",
    "🥪 Enjoying Lunch",
    "⛔ OOO",
    "🚫 Do Not Disturb",
];

type UserProfileStatusProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    user?: UserProps;
    setShowEmojiPicker: (value: boolean) => void;
    selectedEmoji: any;
    setSelectedEmoji: (value: any) => void;
};
export const UserProfileStatus = (props: UserProfileStatusProps) => {
    const { myself, setMyself, user, setShowEmojiPicker, selectedEmoji, setSelectedEmoji } = props;
    const { accessToken } = useAuth();

    const [openCustomStatusEditor, setOpenCustomStatusEditor] = useState(false);
    const [isStatusUpdated, setIsStatusUpdated] = useState(false);
    const [newStatus, setNewStatus] = useState("");
    const [customStatusValue, setCustomStatusValue] = useState(
        user ? user.customStatus : "Update Status"
    );
    useEffect(() => {
        if (isStatusUpdated === false && openCustomStatusEditor === false) {
            setCustomStatusValue(user ? user.customStatus : "Update Status");
        }
    }, [user, isStatusUpdated]);

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
        <Typography
            component="div"
            fontSize={28}
            fontWeight="bold"
            noWrap
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
                                variant="plain"
                                size="md"
                                color="neutral"
                                sx={{
                                    borderRadius: "sm",
                                    fontSize: "16px",
                                }}
                                startDecorator={
                                    <Box sx={{ ml: "-5px" }}>
                                        <PulseDot
                                            color={user?.isOnline === true ? "#4caf50" : "#999"}
                                        />
                                    </Box>
                                }
                                slotProps={{
                                    root: {
                                        component: "span",
                                    },
                                }}
                            >
                                {user?.isOnline === true ? "Online" : "Offline"}
                            </Chip>
                        </MenuButton>
                        {myself.userId === user?.userId && (
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
                                    Set Always Offline
                                </MenuItem>
                            </Menu>
                        )}
                    </Dropdown>

                    {myself.userId === user?.userId && (
                        <>
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
                                    {myself.customStatus !== ""
                                        ? myself.customStatus
                                        : "Update Status"}
                                </Chip>
                            )}
                        </>
                    )}

                    {myself.userId !== user?.userId && (
                        <>
                            {openCustomStatusEditor === false && (
                                <Chip
                                    variant="outlined"
                                    size="lg"
                                    color="neutral"
                                    sx={{ borderRadius: "sm" }}
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
                        <Stack direction={"row"} spacing={0.5}>
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
                                size="sm"
                                placeholder="Set your status…"
                                variant="outlined"
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                            />
                            <Chip
                                variant="soft"
                                size="sm"
                                color="primary"
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
                            </Chip>
                            <Chip
                                variant="outlined"
                                size="sm"
                                color="danger"
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
                            </Chip>
                            <Chip
                                variant="outlined"
                                size="sm"
                                color="neutral"
                                sx={{
                                    borderRadius: "sm",
                                    fontWeight: "bold",
                                }}
                                onClick={() => {
                                    setOpenCustomStatusEditor(false);
                                }}
                            >
                                CANCEL
                            </Chip>
                        </Stack>
                    )}
                </Stack>
            }
        >
            {user?.userName}
        </Typography>
    );
};
