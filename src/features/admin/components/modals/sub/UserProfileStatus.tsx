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
import { useColorScheme } from "@mui/joy/styles";

import { PulseDot } from "../../../../../components/ui/misc/PulseDot";
import { ProfileModalStyles } from "../../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../../context/AuthContext";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { updateUserProfile } from "../../../services/updateUserProfile";

const PRESET_STATUSES = [
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

const PRESENCE_GREEN = "#4caf50";
const PRESENCE_GREY = "#999";

type Props = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    isYou: boolean;
    user?: UserProps;
    setShowEmojiPicker: (value: boolean) => void;
    selectedEmoji: any;
    setSelectedEmoji: (value: any) => void;
};

export const UserProfileStatus = ({
    myself,
    setMyself,
    isYou,
    user,
    setShowEmojiPicker,
    selectedEmoji,
    setSelectedEmoji,
}: Props) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const styles = mode === "dark" ? ProfileModalStyles.dark : ProfileModalStyles.light;

    // Derive directly from props. Mirroring this in useState — as the
    // previous version did — produced a stale `profileUser` whenever
    // `myself` updated without `user` changing, because the sync effect's
    // dep array only watched `user`.
    const profileUser = isYou ? myself : user;
    const isSelfView = myself.userId === profileUser?.userId;

    const isOffline = isSelfView
        ? myself.isOfflineForced === "true"
        : profileUser?.isOnline !== true || profileUser?.isOfflineForced === "true";
    const presenceColor = isOffline ? PRESENCE_GREY : PRESENCE_GREEN;
    const presenceLabel = isOffline
        ? isSelfView
            ? t.admin.status.offlineForced
            : t.admin.status.offline
        : t.admin.status.online;
    const customStatus = profileUser?.customStatus ?? "";

    const [openEditor, setOpenEditor] = useState(false);
    const [newStatus, setNewStatus] = useState("");

    // The emoji picker lives in the parent modal; it pushes a selected
    // emoji back through `selectedEmoji`. Functional setState here avoids
    // clobbering edits the user made between opening the picker and
    // picking an emoji.
    useEffect(() => {
        if (selectedEmoji == null) return;
        setNewStatus((prev) => `${selectedEmoji} ${prev}`);
        setSelectedEmoji(null);
    }, [selectedEmoji, setSelectedEmoji]);

    const handleOpenEditor = () => {
        setNewStatus(myself.customStatus ?? "");
        setOpenEditor(true);
    };
    const handleCloseEditor = () => setOpenEditor(false);

    const persistCustomStatus = (status: string) => {
        updateUserProfile({
            accessToken: accessToken,
            userId: myself.userId,
            customStatus: status,
        });
        setMyself({ ...myself, customStatus: status });
        localStorage.setItem("customStatus", status);
    };
    const handleSet = () => {
        if (newStatus !== "") persistCustomStatus(newStatus);
        handleCloseEditor();
    };
    const handleReset = () => {
        persistCustomStatus("");
        setNewStatus("");
        handleCloseEditor();
    };

    const persistPresence = (forced: "true" | "false") => {
        updateUserProfile({
            accessToken: accessToken,
            userId: myself.userId,
            isOfflineForced: forced,
        });
        setMyself({ ...myself, isOfflineForced: forced });
        localStorage.setItem("isOfflineForced", forced);
    };

    const chipBase = {
        borderRadius: "sm",
        fontSize: "16px",
    } as const;

    return (
        <Stack direction="column" spacing={1}>
            <Typography
                component="div"
                fontSize={28}
                fontWeight="bold"
                noWrap
                endDecorator={
                    <Stack direction="row" spacing={0.5}>
                        {/* Presence chip — dropdown for self, static for others */}
                        <Dropdown>
                            <MenuButton
                                disabled={!isSelfView}
                                slots={{ root: IconButton }}
                                slotProps={{
                                    root: { variant: "outlined", color: "neutral" },
                                }}
                            >
                                <Chip
                                    color="neutral"
                                    size="md"
                                    variant="plain"
                                    slotProps={{ root: { component: "span" } }}
                                    startDecorator={
                                        <Box sx={{ ml: "-5px" }}>
                                            <PulseDot color={presenceColor} />
                                        </Box>
                                    }
                                    sx={chipBase}
                                >
                                    {presenceLabel}
                                </Chip>
                            </MenuButton>
                            {isSelfView && (
                                <Menu sx={{ zIndex: 10010 }}>
                                    <MenuItem onClick={() => persistPresence("false")}>
                                        <PulseDot color={PRESENCE_GREEN} />
                                        {t.admin.status.setOnline}
                                    </MenuItem>
                                    <MenuItem onClick={() => persistPresence("true")}>
                                        <PulseDot color={PRESENCE_GREY} />
                                        {t.admin.status.setAlwaysOffline}
                                    </MenuItem>
                                </Menu>
                            )}
                        </Dropdown>

                        {!openEditor && (
                            <Chip
                                color="neutral"
                                size="md"
                                variant="outlined"
                                onClick={isSelfView ? handleOpenEditor : undefined}
                                sx={{
                                    ...chipBase,
                                    cursor: isSelfView ? "pointer" : "default",
                                    transition: "background-color 0.15s ease",
                                    "&:hover": isSelfView
                                        ? { backgroundColor: styles.hoverBg }
                                        : undefined,
                                }}
                            >
                                {customStatus !== "" ? customStatus : t.admin.status.updateStatus}
                            </Chip>
                        )}

                        {openEditor && (
                            <Stack direction="row" justifyContent="center" spacing={0.5}>
                                <IconButton
                                    variant="outlined"
                                    onClick={() => setShowEmojiPicker(true)}
                                >
                                    <SentimentSatisfiedAltIcon />
                                </IconButton>
                                <Dropdown>
                                    <MenuButton
                                        slots={{ root: IconButton }}
                                        slotProps={{
                                            root: { variant: "outlined", color: "neutral" },
                                        }}
                                    >
                                        <ArrowDropDown />
                                    </MenuButton>
                                    <Menu sx={{ zIndex: 10010 }}>
                                        {PRESET_STATUSES.map((template) => (
                                            <MenuItem
                                                key={template}
                                                onClick={() => setNewStatus(template)}
                                            >
                                                {template}
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                </Dropdown>
                                <Input
                                    placeholder={t.admin.status.setStatusPlaceholder}
                                    size="sm"
                                    sx={{ width: 200 }}
                                    value={newStatus}
                                    variant="outlined"
                                    onChange={(e) => setNewStatus(e.target.value)}
                                />
                            </Stack>
                        )}
                    </Stack>
                }
            >
                {profileUser?.userName}
            </Typography>

            {openEditor && (
                <Stack direction="row" justifyContent="center" spacing={0.5}>
                    <Button
                        color="danger"
                        size="md"
                        variant="outlined"
                        sx={{ borderRadius: "sm", fontWeight: "bold" }}
                        onClick={handleReset}
                    >
                        {t.admin.status.reset}
                    </Button>
                    <Button
                        color="neutral"
                        size="md"
                        variant="outlined"
                        sx={{ borderRadius: "sm", fontWeight: "bold" }}
                        onClick={handleCloseEditor}
                    >
                        {t.admin.status.cancel}
                    </Button>
                    <Button
                        color="primary"
                        size="md"
                        variant="soft"
                        sx={{ borderRadius: "sm", fontWeight: "bold" }}
                        onClick={handleSet}
                    >
                        {t.admin.status.set}
                    </Button>
                </Stack>
            )}
        </Stack>
    );
};
