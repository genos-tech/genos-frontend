import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";
import EditIcon from "@mui/icons-material/Edit";
import NotificationsPausedRoundedIcon from "@mui/icons-material/NotificationsPausedRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import {
    Box,
    Button,
    Chip,
    Dropdown,
    IconButton,
    Input,
    ListDivider,
    Menu,
    MenuButton,
    MenuItem,
    Modal,
    ModalClose,
    ModalDialog,
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
import { announcePresenceChange } from "../../../../../hooks/common/presenceEvents";
import { fmt, useTranslation } from "../../../../../i18n";
import {
    formatPauseStatusText,
    NotificationPausePresetItems,
} from "../../../../../services/notifications/NotificationPausePicker";
import { useNotificationsContext } from "../../../../../services/notifications/NotificationsContext";
import {
    formatStatusExpiry,
    isStatusExpired,
    msUntilStatusExpiry,
    STATUS_EXPIRY_1H,
    STATUS_EXPIRY_4H,
    STATUS_EXPIRY_30M,
    statusExpiryEndOfThisWeek,
    statusExpiryEndOfToday,
    statusExpiryIn,
    toLocalInputValue,
} from "../../../../../services/notifications/statusExpiry";
import { UserProps } from "../../../../../types/admin";
import { resolveDisplayZone } from "../../../../../utils/userTimezone";
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
    // The status-expiry ("clear after…") i18n subtree, aliased for the editor
    // dropdown and the custom-datetime modal below.
    const seT = t.services.notifications.statusExpiry;

    // Slack-style pause presets, shown to the owner in their own presence
    // menu. Optional: this modal also renders in harnesses without a
    // NotificationsProvider, so it degrades to "no pause rows" rather than
    // throwing. Full controls (custom time + schedule) live in Settings.
    const notif = useNotificationsContext();

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

    // --- Custom-status expiry ("clear status after", Slack) -----------------
    // The expiry is the single source of truth, evaluated lazily at read time
    // (same discipline as the notification snooze). A past expiry masks the
    // status for EVERYONE: it renders as if no status is set. The owner's own
    // client additionally PUT-clears on expiry so the DB converges (effect
    // below). Re-checked every 30s so a lapse hides the status without needing
    // the modal to be re-opened.
    const [expiryTick, setExpiryTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setExpiryTick((n) => n + 1), 30_000);
        return () => clearInterval(id);
    }, []);
    const rawStatus = profileUser?.customStatus ?? "";
    const statusExpiryIso = profileUser?.customStatusExpiry ?? null;
    // expiryTick is read only to re-derive on the interval; reference it so the
    // dependency is explicit and lint doesn't flag the effect's tick as unused.
    void expiryTick;
    const expired = isStatusExpired(statusExpiryIso);
    // Masked view: an expired status reads as empty everywhere.
    const customStatus = expired ? "" : rawStatus;
    const showExpiryNote = !expired && !!statusExpiryIso && customStatus !== "";

    // The user's resolved zone, for the LOCAL wall-clock presets (Today / This
    // week). Self only ever sets an expiry, so resolve as self.
    const zone = useMemo(
        () => resolveDisplayZone(myself, true) ?? "UTC",
        [myself.currentLocation, myself.timezone]
    );

    const [openEditor, setOpenEditor] = useState(false);
    const [newStatus, setNewStatus] = useState("");
    // The expiry chosen in the editor (absolute ISO instant, or null for
    // "Don't clear"). Seeded from the current value when the editor opens.
    const [newExpiry, setNewExpiry] = useState<string | null>(null);

    // --- Custom date/time modal for the status expiry (owned here so it
    // survives the "Clear after…" menu closing) --------------------------
    const [expiryCustomOpen, setExpiryCustomOpen] = useState(false);
    const [expiryCustomValue, setExpiryCustomValue] = useState("");
    const openExpiryCustom = () => {
        // Seed one hour ahead so the picker opens on a sensible near-future
        // value rather than "now".
        setExpiryCustomValue(toLocalInputValue(new Date(Date.now() + STATUS_EXPIRY_1H)));
        setExpiryCustomOpen(true);
    };
    const commitExpiryCustom = () => {
        if (!expiryCustomValue) return;
        const parsed = new Date(expiryCustomValue);
        if (!Number.isNaN(parsed.getTime())) setNewExpiry(parsed.toISOString());
        setExpiryCustomOpen(false);
    };

    // --- Custom date/time modal for the notification PAUSE (ask: "pause until
    // Aug 11, 9 AM"). Owned here so it outlives the pause dropdown closing;
    // commits via the pause hook's `pauseUntil(iso)`. ---------------------
    const [pauseCustomOpen, setPauseCustomOpen] = useState(false);
    const [pauseCustomValue, setPauseCustomValue] = useState("");
    const openPauseCustom = () => {
        setPauseCustomValue(toLocalInputValue(new Date(Date.now() + STATUS_EXPIRY_1H)));
        setPauseCustomOpen(true);
    };
    const commitPauseCustom = () => {
        if (!pauseCustomValue) return;
        const parsed = new Date(pauseCustomValue);
        if (!Number.isNaN(parsed.getTime())) notif?.pauseUntil(parsed.toISOString());
        setPauseCustomOpen(false);
    };

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
        // Seed the expiry from the current live value, masking a stale one so
        // re-opening a lapsed status doesn't re-offer its past expiry.
        setNewExpiry(
            isStatusExpired(myself.customStatusExpiry) ? null : (myself.customStatusExpiry ?? null)
        );
        setOpenEditor(true);
    };
    const handleCloseEditor = () => setOpenEditor(false);

    // PUT status + expiry together. `expiryIso` null clears the expiry (Slack
    // "Don't clear" / a reset), and the server exempts the field from its
    // None-strip so the null actually lands. Both localStorage keys are written
    // so the next heartbeat carries the pair; `announcePresenceChange` beats
    // immediately so other users + this user's own other devices converge in
    // <1s rather than on the next 60s tick.
    const persistCustomStatus = useCallback(
        (status: string, expiryIso: string | null) => {
            // Clearing the status clears any expiry with it — an expiry on an
            // empty status is meaningless and would auto-fire on nothing.
            const nextExpiry = status === "" ? null : expiryIso;
            updateUserProfile({
                accessToken: accessToken,
                userId: myself.userId,
                customStatus: status,
                customStatusExpiry: nextExpiry,
            });
            setMyself({ ...myself, customStatus: status, customStatusExpiry: nextExpiry });
            localStorage.setItem("customStatus", status);
            localStorage.setItem("customStatusExpiry", nextExpiry ?? "");
            announcePresenceChange();
        },
        [accessToken, myself, setMyself]
    );
    const handleSet = () => {
        if (newStatus !== "") persistCustomStatus(newStatus, newExpiry);
        handleCloseEditor();
    };
    const handleReset = () => {
        persistCustomStatus("", null);
        setNewStatus("");
        setNewExpiry(null);
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
        // Beat immediately (see persistCustomStatus) so appear-offline flips
        // for other users and this user's other devices right away.
        announcePresenceChange();
    };

    // Owner auto-clear: when this is MY profile and my status has a FUTURE
    // expiry, arm a one-shot timer to the exact instant it lapses and PUT-clear
    // both fields so the DB converges and every other client gets the beat.
    // Client-side masking (above) already hides it visually the moment it
    // passes; this makes the clear durable. Guarded to self, and re-armed
    // whenever the live expiry changes (edit, reconcile). Mirrors the pause
    // hook's reactive-expiry setTimeout.
    const persistRef = useRef(persistCustomStatus);
    persistRef.current = persistCustomStatus;
    useEffect(() => {
        if (!isSelfView) return;
        const ownExpiry = myself.customStatusExpiry ?? null;
        const ownStatus = myself.customStatus ?? "";
        if (!ownExpiry || ownStatus === "") return;
        const ms = msUntilStatusExpiry(ownExpiry);
        if (ms === null) return; // already elapsed — masking + next beat handle it
        // +250ms so it fires strictly after the boundary (see BOUNDARY_BUFFER
        // in the pause hook).
        const id = setTimeout(() => persistRef.current("", null), ms + 250);
        return () => clearTimeout(id);
    }, [isSelfView, myself.customStatusExpiry, myself.customStatus]);

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
                                    {/* Presence only — the pause presets moved
                                        to their own dedicated button next to
                                        this chip (they are a separate concern
                                        from online/offline). */}
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

                        {/* Dedicated pause-notifications button (self only).
                            A separate control from the presence chip above:
                            it opens ONLY the pause presets, including the
                            custom date/time picker (ask: "pause until Aug 11,
                            9 AM"). Absent outside a NotificationsProvider (test
                            harnesses). Full controls: Settings → notifications. */}
                        {isSelfView && notif && (
                            <Dropdown>
                                <AppTooltip
                                    size="sm"
                                    title={
                                        notif.isPausedNow
                                            ? t.services.notifications.pause.selfTooltip
                                            : t.services.notifications.pause.pauseButton
                                    }
                                >
                                    <MenuButton
                                        slots={{ root: IconButton }}
                                        slotProps={{
                                            root: {
                                                variant: notif.isPausedNow ? "soft" : "outlined",
                                                color: notif.isPausedNow ? "warning" : "neutral",
                                                size: "sm",
                                                "aria-label":
                                                    t.services.notifications.pause.pauseButton,
                                            },
                                        }}
                                    >
                                        <NotificationsPausedRoundedIcon />
                                    </MenuButton>
                                </AppTooltip>
                                <Menu sx={{ zIndex: 10010 }} placement="bottom-end">
                                    <NotificationPausePresetItems
                                        isPausedNow={notif.isPausedNow}
                                        pauseFor={notif.pauseFor}
                                        pauseUntilTomorrow={notif.pauseUntilTomorrow}
                                        pauseUntilNextWeek={notif.pauseUntilNextWeek}
                                        resume={notif.resume}
                                        onCustom={openPauseCustom}
                                    />
                                </Menu>
                            </Dropdown>
                        )}

                        {/* Self always sees the chip (it doubles as the
                            "Update Status" button when empty). For other
                            members, only show it when they actually have a
                            status set — never the "Update Status" prompt,
                            which you can't act on for someone else. */}
                        {!openEditor && (isSelfView || customStatus !== "") && (
                            <Stack
                                direction="row"
                                alignItems="center"
                                spacing={0.5}
                                sx={{ minWidth: 0, flexWrap: "wrap", gap: 0.5 }}
                            >
                                <Chip
                                    color="neutral"
                                    size="md"
                                    variant="outlined"
                                    sx={{
                                        ...chipBase,
                                        // Match the presence chip's visual size:
                                        // that chip's box is its md IconButton
                                        // wrapper (2.25rem tall), while this one
                                        // is a bare md Chip (1.75rem, 0.75rem
                                        // inline padding) whose 16px text left it
                                        // looking short and cramped. Lift the
                                        // height to line up and widen the inline
                                        // padding for breathing room. Set on this
                                        // chip's own sx — NOT chipBase, which the
                                        // presence chip shares and would inflate.
                                        "--Chip-minHeight": "2.25rem",
                                        "--Chip-paddingInline": "0.875rem",
                                        cursor: isSelfView ? "pointer" : "default",
                                        transition: "background-color 0.15s ease",
                                        "&:hover": isSelfView
                                            ? { backgroundColor: styles.hoverBg }
                                            : undefined,
                                    }}
                                    onClick={isSelfView ? handleOpenEditor : undefined}
                                >
                                    {customStatus !== ""
                                        ? customStatus
                                        : t.admin.status.updateStatus}
                                </Chip>
                                {/* Everyone sees when the status clears, so a
                                    teammate reads "back Tue 9 AM". Subtle,
                                    normal-weight, non-interactive. */}
                                {showExpiryNote && (
                                    <Typography
                                        level="body-xs"
                                        sx={{ color: "text.tertiary", whiteSpace: "nowrap" }}
                                    >
                                        {fmt(t.services.notifications.statusExpiry.until, {
                                            time: formatStatusExpiry(statusExpiryIso),
                                        })}
                                    </Typography>
                                )}
                            </Stack>
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
                                {/* "Clear after…" — the Slack expiry preset set.
                                    The chosen value shows as the button label so
                                    the current choice is visible at a glance. */}
                                <Dropdown>
                                    <MenuButton
                                        size="sm"
                                        variant="outlined"
                                        color="neutral"
                                        startDecorator={<ScheduleRoundedIcon fontSize="small" />}
                                    >
                                        {newExpiry
                                            ? formatStatusExpiry(newExpiry)
                                            : seT.clearAfterLabel}
                                    </MenuButton>
                                    <Menu sx={{ zIndex: 10010 }} placement="bottom-end">
                                        <MenuItem onClick={() => setNewExpiry(null)}>
                                            {seT.clearNever}
                                        </MenuItem>
                                        <ListDivider />
                                        <MenuItem
                                            onClick={() =>
                                                setNewExpiry(statusExpiryIn(STATUS_EXPIRY_30M))
                                            }
                                        >
                                            {seT.for30m}
                                        </MenuItem>
                                        <MenuItem
                                            onClick={() =>
                                                setNewExpiry(statusExpiryIn(STATUS_EXPIRY_1H))
                                            }
                                        >
                                            {seT.for1h}
                                        </MenuItem>
                                        <MenuItem
                                            onClick={() =>
                                                setNewExpiry(statusExpiryIn(STATUS_EXPIRY_4H))
                                            }
                                        >
                                            {seT.for4h}
                                        </MenuItem>
                                        <MenuItem
                                            onClick={() =>
                                                setNewExpiry(statusExpiryEndOfToday(zone))
                                            }
                                        >
                                            {seT.today}
                                        </MenuItem>
                                        <MenuItem
                                            onClick={() =>
                                                setNewExpiry(statusExpiryEndOfThisWeek(zone))
                                            }
                                        >
                                            {seT.thisWeek}
                                        </MenuItem>
                                        <ListDivider />
                                        <MenuItem onClick={openExpiryCustom}>
                                            {seT.custom}
                                        </MenuItem>
                                    </Menu>
                                </Dropdown>
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

            {/* Self-only pause status line: when MY notifications are paused,
                show until when (or the schedule window). The pause expiry /
                schedule are private — only the paused boolean is broadcast — so
                this is never shown for other members, only for me. Reuses the
                exact wording from the Settings pause section. */}
            {isSelfView && notif?.isPausedNow && (
                <Stack alignItems="center" direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
                    <NotificationsPausedRoundedIcon sx={{ fontSize: 16, color: "warning.500" }} />
                    <Typography level="body-xs" sx={{ color: "warning.500", fontWeight: 600 }}>
                        {formatPauseStatusText(
                            {
                                isPausedNow: notif.isPausedNow,
                                snoozeUntil: notif.snoozeUntil,
                                snoozeSchedule: notif.snoozeSchedule,
                            },
                            t.services.notifications.pause
                        )}
                    </Typography>
                </Stack>
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

            {/* Custom date/time for the STATUS expiry ("Clear after → Pick a
                date & time…"). Owned at this level so it survives the editor's
                "Clear after…" menu closing on click. Sets the draft `newExpiry`
                only — the actual PUT happens when the user hits Set. */}
            <Modal
                open={expiryCustomOpen}
                sx={{ zIndex: 10020 }}
                onClose={() => setExpiryCustomOpen(false)}
            >
                <ModalDialog>
                    <ModalClose />
                    <Typography level="title-md">{seT.customTitle}</Typography>
                    <Input
                        type="datetime-local"
                        value={expiryCustomValue}
                        slotProps={{ input: { min: toLocalInputValue(new Date()) } }}
                        onChange={(e) => setExpiryCustomValue(e.target.value)}
                    />
                    <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
                        <Button
                            color="neutral"
                            variant="plain"
                            onClick={() => setExpiryCustomOpen(false)}
                        >
                            {seT.customCancel}
                        </Button>
                        <Button disabled={!expiryCustomValue} onClick={commitExpiryCustom}>
                            {seT.customSet}
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>

            {/* Custom date/time for the notification PAUSE ("pause until Aug 11,
                9 AM"). Commits straight through the pause hook — unlike the
                status expiry, there is no separate Set step for a pause. */}
            <Modal
                open={pauseCustomOpen}
                sx={{ zIndex: 10020 }}
                onClose={() => setPauseCustomOpen(false)}
            >
                <ModalDialog>
                    <ModalClose />
                    <Typography level="title-md">
                        {t.services.notifications.pause.customTitle}
                    </Typography>
                    <Input
                        type="datetime-local"
                        value={pauseCustomValue}
                        slotProps={{ input: { min: toLocalInputValue(new Date()) } }}
                        onChange={(e) => setPauseCustomValue(e.target.value)}
                    />
                    <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
                        <Button
                            color="neutral"
                            variant="plain"
                            onClick={() => setPauseCustomOpen(false)}
                        >
                            {t.services.notifications.pause.customCancel}
                        </Button>
                        <Button disabled={!pauseCustomValue} onClick={commitPauseCustom}>
                            {t.services.notifications.pause.customSet}
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </Stack>
    );
};
