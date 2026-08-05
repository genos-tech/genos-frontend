import { useEffect, useState } from "react";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";
import EditIcon from "@mui/icons-material/Edit";
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

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { useOptionalAvatarContext } from "../../../../../components/ui/avatars/AvatarContext";
import { PulseDot } from "../../../../../components/ui/misc/PulseDot";
import { ProfileModalStyles } from "../../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../../context/AuthContext";
import { UserRepository } from "../../../../../db/repositories/user";
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

    // Optional: when this modal is rendered inside the AvatarContextProvider
    // (the authenticated shell), a rename propagates instantly to every other
    // "you" surface via the team-members map. Absent (older callsites, test
    // harnesses) it's skipped and the 60s `popTeamUsersWorker` tick catches up.
    const avatarCtx = useOptionalAvatarContext();

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

    // Inline display-name rename — self only. The user edits the name
    // shown as the hero heading here. Unlike the sibling status / role /
    // country editors (fire-and-forget), this awaits the PUT and only
    // commits the local `myself` + localStorage write on success, so a
    // rejected save (too long, network) doesn't leave a name on screen
    // that didn't persist. Owner-gated team / project / GM renames live
    // in their own modals; this is the per-user equivalent.
    const [nameEditMode, setNameEditMode] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);
    const [nameSaving, setNameSaving] = useState(false);

    const handleNameSave = async () => {
        const next = nameDraft.trim();
        if (!next) {
            setNameError(t.common.profileEdit.nameEmpty);
            return;
        }
        if (next === (myself.userName ?? "")) {
            setNameEditMode(false);
            setNameError(null);
            return;
        }
        setNameSaving(true);
        setNameError(null);
        const result = await updateUserProfile({
            accessToken: accessToken,
            userId: myself.userId,
            userName: next,
        });
        setNameSaving(false);
        if (result) {
            const updatedMyself: UserProps = { ...myself, userName: next };
            setMyself(updatedMyself);
            localStorage.setItem("userName", next);
            setNameEditMode(false);

            // Propagate the rename to every other "you" surface (chat list,
            // bubbles, mentions, task rows, comments) immediately instead of
            // waiting up to 60s for the next `popTeamUsersWorker` tick. This
            // is the name-equivalent of the avatar-upload propagation in
            // `ModalUserProfile`.
            avatarCtx?.setTeamMemberProfiles((prev) => {
                const existing = prev[myself.userId];
                return {
                    ...prev,
                    [myself.userId]: {
                        ...(existing ?? updatedMyself),
                        userName: next,
                    },
                };
            });

            // Write through to IndexedDB so the next reload starts consistent
            // rather than serving the pre-rename cached name until the next
            // worker pop overwrites it.
            try {
                const userRepo = new UserRepository();
                const cached = avatarCtx?.teamMemberProfiles[myself.userId] ?? updatedMyself;
                await userRepo.saveUser({ ...cached, userName: next });
            } catch (err) {
                console.error("Failed to persist name update to IndexedDB:", err);
            }
        } else {
            setNameError(t.common.profileEdit.renameError);
        }
    };

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
        <Stack direction="column" spacing={1} sx={{ width: "100%", minWidth: 0 }}>
            <Typography
                component="div"
                fontSize={{ xs: 22, md: 28 }}
                fontWeight="bold"
                // Allow the username + chips row to wrap on mobile so
                // the "Update Status" chip doesn't get clipped at the
                // right edge of the modal. Desktop stays single-line.
                endDecorator={
                    <Stack
                        direction="row"
                        spacing={0.5}
                        // Hide the presence / status chips while the name is
                        // being edited so they don't crowd the rename input.
                        sx={{
                            display: nameEditMode ? "none" : "flex",
                            flexWrap: "wrap",
                            gap: 0.5,
                            minWidth: 0,
                        }}
                    >
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
                                    slotProps={{ root: { component: "span" } }}
                                    sx={chipBase}
                                    variant="plain"
                                    startDecorator={
                                        <Box sx={{ ml: "-5px" }}>
                                            <PulseDot color={presenceColor} />
                                        </Box>
                                    }
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

                        {/* Self always sees the chip (it doubles as the
                            "Update Status" button when empty). For other
                            members, only show it when they actually have a
                            status set — never the "Update Status" prompt,
                            which you can't act on for someone else. */}
                        {!openEditor && (isSelfView || customStatus !== "") && (
                            <Chip
                                color="neutral"
                                size="md"
                                variant="outlined"
                                sx={{
                                    ...chipBase,
                                    cursor: isSelfView ? "pointer" : "default",
                                    transition: "background-color 0.15s ease",
                                    "&:hover": isSelfView
                                        ? { backgroundColor: styles.hoverBg }
                                        : undefined,
                                }}
                                onClick={isSelfView ? handleOpenEditor : undefined}
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
                sx={{
                    display: "flex",
                    flexWrap: { xs: "wrap", md: "nowrap" },
                    alignItems: "center",
                    gap: 1,
                    minWidth: 0,
                    "& > :first-of-type": {
                        whiteSpace: { xs: "normal", md: "nowrap" },
                        overflow: { xs: "visible", md: "hidden" },
                        textOverflow: { xs: "clip", md: "ellipsis" },
                        wordBreak: "break-word",
                        minWidth: 0,
                    },
                }}
            >
                {!isSelfView ? (
                    profileUser?.userName
                ) : nameEditMode ? (
                    <Stack
                        alignItems="center"
                        component="span"
                        direction="row"
                        spacing={0.5}
                        sx={{ flexWrap: "wrap", gap: 0.5, minWidth: 0 }}
                    >
                        <Input
                            size="sm"
                            value={nameDraft}
                            slotProps={{
                                input: {
                                    maxLength: 50,
                                    onKeyDown: (e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            void handleNameSave();
                                        }
                                        if (e.key === "Escape") {
                                            setNameEditMode(false);
                                            setNameError(null);
                                        }
                                    },
                                },
                            }}
                            // Pin keydown to the inner <input> via slotProps so
                            // Enter / Escape land on the typing target, and force
                            // a normal font/size so the field doesn't inherit the
                            // 28px bold heading style of the surrounding heading.
                            sx={{
                                flexGrow: 1,
                                minWidth: 140,
                                maxWidth: 320,
                                fontSize: "16px",
                                fontWeight: 400,
                                "--Input-radius": "8px",
                            }}
                            autoFocus
                            onChange={(e) => setNameDraft(e.target.value)}
                        />
                        <Button
                            loading={nameSaving}
                            size="sm"
                            variant="solid"
                            onClick={handleNameSave}
                        >
                            {t.common.profileEdit.save}
                        </Button>
                        <Button
                            color="neutral"
                            size="sm"
                            variant="plain"
                            onClick={() => {
                                setNameEditMode(false);
                                setNameError(null);
                            }}
                        >
                            {t.common.profileEdit.cancel}
                        </Button>
                    </Stack>
                ) : (
                    <Stack
                        alignItems="center"
                        component="span"
                        direction="row"
                        spacing={0.5}
                        sx={{ minWidth: 0 }}
                    >
                        <Box
                            component="span"
                            sx={{
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: { xs: "normal", md: "nowrap" },
                                wordBreak: "break-word",
                            }}
                        >
                            {/* `isSelfView` guarantees this is me, so read the
                                live `myself.userName` rather than `profileUser`
                                — which can be a stale team-map copy when the
                                modal was opened by clicking your own row in a
                                member list. Keeps the hero name in sync right
                                after a successful rename. */}
                            {myself.userName}
                        </Box>
                        <AppTooltip size="sm" title={t.common.profileEdit.rename}>
                            <IconButton
                                size="sm"
                                sx={{ flexShrink: 0 }}
                                variant="plain"
                                onClick={() => {
                                    setNameDraft(myself.userName ?? "");
                                    setNameError(null);
                                    setNameEditMode(true);
                                }}
                            >
                                <EditIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </AppTooltip>
                    </Stack>
                )}
            </Typography>
            {isSelfView && nameError && (
                <Typography
                    level="body-xs"
                    sx={{ color: "rgba(var(--gp-tint-danger-rgb), 0.9)", mt: 0.5 }}
                >
                    {nameError}
                </Typography>
            )}

            {openEditor && (
                <Stack direction="row" justifyContent="center" spacing={0.5}>
                    <Button
                        color="danger"
                        size="md"
                        sx={{ borderRadius: "sm", fontWeight: "bold" }}
                        variant="outlined"
                        onClick={handleReset}
                    >
                        {t.admin.status.reset}
                    </Button>
                    <Button
                        color="neutral"
                        size="md"
                        sx={{ borderRadius: "sm", fontWeight: "bold" }}
                        variant="outlined"
                        onClick={handleCloseEditor}
                    >
                        {t.admin.status.cancel}
                    </Button>
                    <Button
                        color="primary"
                        size="md"
                        sx={{ borderRadius: "sm", fontWeight: "bold" }}
                        variant="soft"
                        onClick={handleSet}
                    >
                        {t.admin.status.set}
                    </Button>
                </Stack>
            )}
        </Stack>
    );
};
