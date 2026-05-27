import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CommentOutlinedIcon from "@mui/icons-material/CommentOutlined";
import EmojiEmotionsRoundedIcon from "@mui/icons-material/EmojiEmotionsRounded";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import StickyNote2OutlinedIcon from "@mui/icons-material/StickyNote2Outlined";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import {
    Box,
    Dropdown,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation, type Messages } from "../../../../i18n";
import { CHIP_ORDER, ChipId } from "../../utils/activityChipFilters";

// Shared divider base component
const DividerBase = ({
    children,
    icon,
}: {
    children: React.ReactNode;
    icon?: React.ReactNode;
}) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <Box
            sx={{
                px: 2,
                py: 1,
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
            }}
        >
            <Stack alignItems="center" direction="row" justifyContent="center" spacing={1}>
                {icon}
                <Typography
                    level="body-xs"
                    sx={{
                        fontWeight: 600,
                        fontSize: 11,
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                        letterSpacing: "0.02em",
                    }}
                >
                    {children}
                </Typography>
            </Stack>
        </Box>
    );
};

export const PinnedDivider = () => {
    const { t } = useTranslation();
    return <DividerBase>{t.chat.sidebar.dividerPinned}</DividerBase>;
};

type GMDividerProps = {
    setOpenCreateGM: (value: boolean) => void;
};

export const GMDivider = (props: GMDividerProps) => {
    const { setOpenCreateGM } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    return (
        <Box
            sx={{
                px: 2,
                py: 0.75,
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
            }}
        >
            <Stack alignItems="center" direction="row" justifyContent="center" spacing={1}>
                <Typography
                    level="body-xs"
                    sx={{
                        fontWeight: 600,
                        fontSize: 11,
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                        letterSpacing: "0.02em",
                    }}
                >
                    {t.chat.sidebar.dividerGroupMessages}
                </Typography>
                <IconButton
                    size="sm"
                    variant="plain"
                    sx={{
                        width: 22,
                        height: 22,
                        minWidth: 22,
                        minHeight: 22,
                        borderRadius: "6px",
                        color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
                        "&:hover": {
                            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                            color: isDark ? "#a78bfa" : "#7c3aed",
                        },
                    }}
                    onClick={() => setOpenCreateGM(true)}
                >
                    <AddRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
            </Stack>
        </Box>
    );
};

export const DMDivider = () => {
    const { t } = useTranslation();
    return <DividerBase>{t.chat.sidebar.dividerDirectMessages}</DividerBase>;
};

export const PMDivider = () => {
    const { t } = useTranslation();
    return <DividerBase>{t.chat.sidebar.dividerProjectUpdates}</DividerBase>;
};

// Activity filter configuration
type ActivityFilterKey = keyof Messages["chat"]["sidebar"];
const ACTIVITY_FILTERS: Array<{
    id: number;
    labelKey: ActivityFilterKey;
    icon: React.ElementType;
}> = [
    { id: 0, labelKey: "activityFilterAll", icon: ViewListRoundedIcon },
    { id: 3, labelKey: "activityFilterMentions", icon: AlternateEmailRoundedIcon },
    { id: 1, labelKey: "activityFilterThreads", icon: ChatBubbleOutlineRoundedIcon },
    { id: 4, labelKey: "activityFilterReactions", icon: EmojiEmotionsRoundedIcon },
    { id: 2, labelKey: "activityFilterTasks", icon: TaskAltRoundedIcon },
];

// Per-chip icon + i18n label for the new multi-select chip filter row.
// Reused icons (Thread/Mention/Reaction/Task) intentionally match the
// single-select row above so a chip with the same icon means the same
// predicate, lowering cognitive load between the two filters.
// Keys sorted alphabetically per `sort-keys`; semantic render order
// lives in `CHIP_ORDER` (the layout iterates through that, not through
// the record's own iteration order).
type ChipMeta = { icon: React.ElementType; labelKey: ActivityFilterKey };
const CHIP_META: Record<ChipId, ChipMeta> = {
    dm: { icon: PersonOutlineRoundedIcon, labelKey: "chipDM" },
    gm: { icon: GroupsOutlinedIcon, labelKey: "chipGM" },
    mdm: { icon: GroupOutlinedIcon, labelKey: "chipMDM" },
    mention: { icon: AlternateEmailRoundedIcon, labelKey: "chipMention" },
    noteChat: { icon: ForumOutlinedIcon, labelKey: "chipNoteChat" },
    noteMy: { icon: StickyNote2OutlinedIcon, labelKey: "chipNoteMy" },
    noteTask: { icon: AssignmentOutlinedIcon, labelKey: "chipNoteTask" },
    pm: { icon: WorkOutlineRoundedIcon, labelKey: "chipPM" },
    project: { icon: FolderOutlinedIcon, labelKey: "chipProject" },
    reaction: { icon: EmojiEmotionsRoundedIcon, labelKey: "chipReaction" },
    reply: { icon: ReplyRoundedIcon, labelKey: "chipReply" },
    task: { icon: TaskAltRoundedIcon, labelKey: "chipTask" },
    taskComment: { icon: CommentOutlinedIcon, labelKey: "chipTaskComment" },
    thread: { icon: ChatBubbleOutlineRoundedIcon, labelKey: "chipThread" },
};

type ActivityDividerProps = {
    currentActivityMessageType: number;
    setCurrentActivityMessageType: (value: number) => void;
    // Multi-select chip refinement is rendered as a "Custom" trigger
    // at the end of this same chip row. Clicking it opens a Joy `Menu`
    // with one item per chip predicate; selections AND-compose with
    // the primary single-select downstream in `ChatList`.
    selectedChipIds: ReadonlySet<ChipId>;
    setSelectedChipIds: (next: ReadonlySet<ChipId>) => void;
};

export const ActivityDivider = (props: ActivityDividerProps) => {
    const {
        currentActivityMessageType,
        setCurrentActivityMessageType,
        selectedChipIds,
        setSelectedChipIds,
    } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    // Primary and Custom are mutually exclusive — toggling a chip in
    // the Custom menu forces the primary single-select back to "All"
    // (id=0) so the existing AND-composition in `useFilteredActivityMessages`
    // naturally produces "only Custom is active" semantics. The mirror
    // happens in `handlePrimaryClick` below.
    const toggleChip = (id: ChipId) => {
        const next = new Set(selectedChipIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedChipIds(next);
        if (currentActivityMessageType !== 0) {
            setCurrentActivityMessageType(0);
        }
    };

    const handlePrimaryClick = (filterId: number) => {
        // Switch / toggle the primary single-select (original behavior:
        // re-clicking a non-All chip reverts to All).
        if (currentActivityMessageType !== filterId) {
            setCurrentActivityMessageType(filterId);
        } else if (filterId !== 0) {
            setCurrentActivityMessageType(0);
        }
        // Mutual exclusion: any user action on the primary row clears
        // the Custom chip set so the two filters never coexist.
        if (selectedChipIds.size > 0) {
            setSelectedChipIds(new Set());
        }
    };

    const hasSelection = selectedChipIds.size > 0;

    // Shared chip-button styling reused by both the existing 5
    // single-select chips and the new "Custom" menu trigger so they
    // sit visually flush in the same row. Sizing is intentionally
    // tight so all 6 chips fit without horizontal scroll in a typical
    // sidebar width.
    const chipButtonSx = (isActive: boolean) => ({
        "&:hover": {
            background: isActive
                ? isDark
                    ? "linear-gradient(135deg, rgba(124,58,237,0.22) 0%, rgba(139,92,246,0.16) 100%)"
                    : "linear-gradient(135deg, rgba(124,58,237,0.16) 0%, rgba(124,58,237,0.1) 100%)"
                : isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.03)",
        },
        alignItems: "center",
        background: isActive
            ? isDark
                ? "linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(139,92,246,0.12) 100%)"
                : "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.06) 100%)"
            : "transparent",
        border: "1px solid",
        borderColor: isActive
            ? isDark
                ? "rgba(139,92,246,0.25)"
                : "rgba(124,58,237,0.15)"
            : "transparent",
        borderRadius: "6px",
        cursor: "pointer",
        display: "flex",
        gap: 0.25,
        minHeight: 0,
        px: 0.75,
        py: 0.25,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        whiteSpace: "nowrap",
    });
    const chipIconSx = (isActive: boolean) => ({
        color: isActive
            ? isDark
                ? "#a78bfa"
                : "#7c3aed"
            : isDark
              ? "rgba(255,255,255,0.45)"
              : "rgba(0,0,0,0.4)",
        fontSize: 13,
        transition: "color 0.2s ease",
    });
    const chipLabelSx = (isActive: boolean) => ({
        color: isActive
            ? isDark
                ? "rgba(255,255,255,0.9)"
                : "rgba(0,0,0,0.85)"
            : isDark
              ? "rgba(255,255,255,0.55)"
              : "rgba(0,0,0,0.5)",
        fontSize: "0.65rem",
        fontWeight: isActive ? 600 : 500,
        transition: "all 0.2s ease",
    });

    return (
        <Box
            sx={{
                px: 1,
                py: 0.75,
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
            }}
        >
            <Stack
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                direction="row"
                spacing={0.25}
                sx={{
                    overflowX: "auto",
                    pb: 0.25,
                    "&::-webkit-scrollbar": {
                        height: 4,
                    },
                }}
            >
                {ACTIVITY_FILTERS.map((filter) => {
                    const Icon = filter.icon;
                    const isActive = currentActivityMessageType === filter.id;

                    return (
                        <Box
                            key={filter.id}
                            sx={chipButtonSx(isActive)}
                            onClick={() => handlePrimaryClick(filter.id)}
                        >
                            <Icon sx={chipIconSx(isActive)} />
                            <Typography level="body-xs" sx={chipLabelSx(isActive)}>
                                {t.chat.sidebar[filter.labelKey]}
                            </Typography>
                        </Box>
                    );
                })}

                {/* "Custom" menu trigger — sits at the end of the same
                    chip row. Active when any chip is selected; the
                    badge shows the selection count. The menu body
                    iterates `CHIP_ORDER` (semantic grouping) and
                    toggles via the parent-supplied setter. */}
                <Dropdown>
                    <MenuButton
                        slots={{ root: Box }}
                        slotProps={{
                            root: {
                                "aria-label": t.chat.sidebar.chipFilterCustomLabel,
                                sx: chipButtonSx(hasSelection),
                            },
                        }}
                    >
                        <TuneRoundedIcon sx={chipIconSx(hasSelection)} />
                        <Typography level="body-xs" sx={chipLabelSx(hasSelection)}>
                            {t.chat.sidebar.chipFilterCustomLabel}
                        </Typography>
                        {hasSelection && (
                            <Box
                                sx={{
                                    alignItems: "center",
                                    background: isDark ? "#a78bfa" : "#7c3aed",
                                    borderRadius: "999px",
                                    color: "#fff",
                                    display: "flex",
                                    fontSize: "0.55rem",
                                    fontWeight: 700,
                                    height: 13,
                                    justifyContent: "center",
                                    lineHeight: 1,
                                    minWidth: 13,
                                    px: 0.375,
                                }}
                            >
                                {selectedChipIds.size}
                            </Box>
                        )}
                    </MenuButton>
                    <Menu
                        placement="bottom-start"
                        size="sm"
                        sx={{
                            background: isDark
                                ? "rgba(30, 30, 40, 0.98)"
                                : "rgba(255, 255, 255, 0.98)",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                            borderRadius: "10px",
                            boxShadow: isDark
                                ? "0 8px 24px rgba(0,0,0,0.5)"
                                : "0 8px 24px rgba(0,0,0,0.12)",
                            maxHeight: 400,
                            minWidth: 200,
                            overflowY: "auto",
                            zIndex: 10010,
                        }}
                    >
                        {CHIP_ORDER.map((id) => {
                            const meta = CHIP_META[id];
                            const Icon = meta.icon;
                            const isChecked = selectedChipIds.has(id);
                            return (
                                <MenuItem
                                    key={id}
                                    selected={isChecked}
                                    sx={{
                                        borderRadius: "6px",
                                        fontSize: "0.8rem",
                                        gap: 1,
                                        mx: 0.5,
                                        py: 0.75,
                                    }}
                                    onClick={(e) => {
                                        // Keep the menu open so users
                                        // can toggle multiple chips in
                                        // one session.
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleChip(id);
                                    }}
                                >
                                    <Box
                                        sx={{
                                            alignItems: "center",
                                            color: isChecked
                                                ? isDark
                                                    ? "#a78bfa"
                                                    : "#7c3aed"
                                                : "transparent",
                                            display: "flex",
                                            justifyContent: "center",
                                            width: 16,
                                        }}
                                    >
                                        <CheckRoundedIcon sx={{ fontSize: 16 }} />
                                    </Box>
                                    <Icon
                                        sx={{
                                            color: isDark
                                                ? "rgba(255,255,255,0.65)"
                                                : "rgba(0,0,0,0.6)",
                                            fontSize: 16,
                                        }}
                                    />
                                    {t.chat.sidebar[meta.labelKey]}
                                </MenuItem>
                            );
                        })}
                        {hasSelection && (
                            <MenuItem
                                sx={{
                                    borderRadius: "6px",
                                    borderTop: "1px solid",
                                    borderTopColor: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.06)",
                                    color: isDark ? "#a78bfa" : "#7c3aed",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    gap: 1,
                                    mt: 0.5,
                                    mx: 0.5,
                                    py: 0.75,
                                }}
                                onClick={() => setSelectedChipIds(new Set())}
                            >
                                {t.chat.sidebar.chipFilterClear}
                            </MenuItem>
                        )}
                    </Menu>
                </Dropdown>
            </Stack>
        </Box>
    );
};
