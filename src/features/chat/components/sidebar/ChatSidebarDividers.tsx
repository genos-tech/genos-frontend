import { Fragment } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CommentOutlinedIcon from "@mui/icons-material/CommentOutlined";
import EmojiEmotionsRoundedIcon from "@mui/icons-material/EmojiEmotionsRounded";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import StickyNote2OutlinedIcon from "@mui/icons-material/StickyNote2Outlined";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import { Box, Dropdown, IconButton, MenuButton, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { Clickable } from "../../../../components/ui/Clickable";
import {
    MenuDivider,
    MenuGroupLabel,
    MenuRow,
    MenuSurface,
} from "../../../../components/ui/MoreMenu";
import { SectionHeader } from "../../../../components/ui/nav/SectionHeader";
import { BoxSlotRoot } from "../../../../components/ui/slotRoot";
import { useMentionGroupsContext } from "../../../../context/MentionGroupsContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useTranslation, type Messages } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { AllChatProps } from "../../../../types/chat";
import {
    CHATTYPE_HEADER_CHIP,
    CHIP_ORDER,
    ChipId,
    GATING_CHIP_TO_CHATTYPES,
    hasGatingChip,
    hasMentionGatingChip,
    makeInstanceKey,
} from "../../utils/activityChipFilters";

// Section headings of the chat list (MIP-1127): the shared SectionHeader, plain
// (these do not collapse). `px: 1` lines them up with the rows beneath.
const DividerBase = ({ children }: { children: React.ReactNode }) => (
    <SectionHeader as="div" label={children} sx={{ mx: 1, mt: 0.5 }} />
);

export const PinnedDivider = () => {
    const { t } = useTranslation();
    return <DividerBase>{t.chat.sidebar.dividerPinned}</DividerBase>;
};

type GMDividerProps = {
    setOpenCreateGM: (value: boolean) => void;
};

export const GMDivider = (props: GMDividerProps) => {
    const { setOpenCreateGM } = props;
    const { t } = useTranslation();

    return (
        <SectionHeader
            as="div"
            label={t.chat.sidebar.dividerGroupMessages}
            sx={{ mx: 1, mt: 0.5 }}
            actions={
                <IconButton
                    aria-label={t.chat.sidebar.newGroupMessageMenu}
                    size="sm"
                    variant="plain"
                    sx={{
                        width: 22,
                        height: 22,
                        minWidth: 22,
                        minHeight: 22,
                        borderRadius: g.radius.sm,
                        color: g.text.tertiary,
                        "&:hover": { background: g.hover, color: g.accent.text },
                    }}
                    onClick={() => setOpenCreateGM(true)}
                >
                    <AddRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
            }
        />
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
    // Instance-name refinement set ("${chatType}-${chatId}" keys).
    // Only consulted when at least one gating chip (project / dm / gm /
    // pm) is in `selectedChipIds` — otherwise the parent auto-clears
    // it so it can't leak into unrelated contexts.
    selectedInstanceIds: ReadonlySet<string>;
    setSelectedInstanceIds: (next: ReadonlySet<string>) => void;
    // Mention-group refinement set (MentionGroup.groupId values).
    // Only consulted when the `mention` chip is in `selectedChipIds` —
    // the parent auto-clears it whenever that gating chip is toggled
    // off so a stale selection can't leak.
    selectedMentionGroupIds: ReadonlySet<number>;
    setSelectedMentionGroupIds: (next: ReadonlySet<number>) => void;
    // Source of chat instances for the "By name" menu. Reads
    // `useCM.allChats` directly — no separate fetch.
    useCM: ChatManagementState;
};

// MDM has no inherent name on the wire — fall back to joining member
// names (matches the convention used by `ThreadChatPaneHeader`'s MDM
// title rendering). DM / GM / PM all carry server-resolved `chatName`.
const resolveChatDisplayName = (chat: AllChatProps): string => {
    if (chat.chatType === 4 && !chat.chatName) {
        return chat.mdmMembers?.map((m) => m.userName).join(", ") || "";
    }
    return chat.chatName || "";
};

// "DM" is the end-user term for both 1:1 (chatType 1) and multi-user
// DMs (chatType 4 without taskId). Bucket them together in the menu.
const groupKeyForChatType = (chatType: number): number => (chatType === 4 ? 1 : chatType);

// Visual order of chat-type sections in the "By name" menu when more
// than one gating chip is selected. Mirrors the chat-list sidebar
// section order (projects → DMs → GMs). chatType 4 is bucketed into
// 1 by `groupKeyForChatType`, so it doesn't get its own section.
const GROUP_ORDER: readonly number[] = [3, 1, 2];

export const ActivityDivider = (props: ActivityDividerProps) => {
    const {
        currentActivityMessageType,
        setCurrentActivityMessageType,
        selectedChipIds,
        setSelectedChipIds,
        selectedInstanceIds,
        setSelectedInstanceIds,
        selectedMentionGroupIds,
        setSelectedMentionGroupIds,
        useCM,
    } = props;
    const { mentionGroups } = useMentionGroupsContext();
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

    const toggleInstance = (key: string) => {
        const next = new Set(selectedInstanceIds);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        setSelectedInstanceIds(next);
    };

    const toggleMentionGroup = (groupId: number) => {
        const next = new Set(selectedMentionGroupIds);
        if (next.has(groupId)) {
            next.delete(groupId);
        } else {
            next.add(groupId);
        }
        setSelectedMentionGroupIds(next);
    };

    // Mention groups sorted by display name for a stable menu order.
    // `useMentionGroups` already lowercases names on create/update, so
    // localeCompare gives us natural alphabetical ordering.
    const sortedMentionGroups = [...mentionGroups].sort((a, b) =>
        a.groupName.localeCompare(b.groupName)
    );
    const showMentionGroupFilter = hasMentionGatingChip(selectedChipIds);
    const hasMentionGroupSelection = selectedMentionGroupIds.size > 0;

    // The "By name" button only renders when a gating chip is active;
    // any instance selection visible to the user therefore necessarily
    // composes with at least one chat-type chip.
    const showInstanceFilter = hasGatingChip(selectedChipIds);
    const hasInstanceSelection = selectedInstanceIds.size > 0;

    // Derive the set of chat-types eligible for the instance menu from
    // the currently-active gating chips. `pm` and `project` both map to
    // chatType=3, `dm` maps to both 1 and 4 — the Set dedupes any
    // overlap automatically.
    const gatedChatTypes = new Set<number>();
    for (const chipId of selectedChipIds) {
        const cts = GATING_CHIP_TO_CHATTYPES[chipId];
        if (cts) for (const ct of cts) gatedChatTypes.add(ct);
    }

    // Filter + sort + group chats for the menu body. Bucketing uses
    // `groupKeyForChatType` so chatType=4 (MDM) folds into the chatType=1
    // (DM) bucket — they render together under the "DM" header.
    const gatedChats = useCM.allChats.filter((c) => gatedChatTypes.has(c.chatType));
    const gatedGroupKeys = new Set<number>();
    for (const ct of gatedChatTypes) gatedGroupKeys.add(groupKeyForChatType(ct));
    const showGroupHeaders = gatedGroupKeys.size > 1;
    const chatsByType = new Map<number, AllChatProps[]>();
    for (const c of gatedChats) {
        const key = groupKeyForChatType(c.chatType);
        const bucket = chatsByType.get(key);
        if (bucket) {
            bucket.push(c);
        } else {
            chatsByType.set(key, [c]);
        }
    }
    for (const [, bucket] of chatsByType) {
        bucket.sort((a, b) => resolveChatDisplayName(a).localeCompare(resolveChatDisplayName(b)));
    }
    const orderedGroups = GROUP_ORDER.filter((ct) => chatsByType.has(ct));

    // Shared chip-button styling reused by both the existing 5
    // single-select chips and the new "Custom" menu trigger so they
    // sit visually flush in the same row. Sizing is intentionally
    // tight so all 6 chips fit without horizontal scroll in a typical
    // sidebar width.
    const chipButtonSx = (isActive: boolean) => ({
        "&:hover": {
            background: isActive
                ? isDark
                    ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.22) 0%, rgba(var(--gp-brandalt-500-rgb), 0.16) 100%)"
                    : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.16) 0%, rgba(var(--gp-brand-700-rgb), 0.1) 100%)"
                : isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.03)",
        },
        alignItems: "center",
        background: isActive
            ? isDark
                ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.18) 0%, rgba(var(--gp-brandalt-500-rgb), 0.12) 100%)"
                : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.12) 0%, rgba(var(--gp-brand-700-rgb), 0.06) 100%)"
            : "transparent",
        border: "1px solid",
        borderColor: isActive
            ? isDark
                ? "rgba(var(--gp-brandalt-500-rgb), 0.25)"
                : "rgba(var(--gp-brand-700-rgb), 0.15)"
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
                ? "var(--gp-brandalt-400)"
                : "var(--gp-brand-700)"
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
                        <Clickable
                            key={filter.id}
                            sx={chipButtonSx(isActive)}
                            onActivate={() => handlePrimaryClick(filter.id)}
                        >
                            <Icon sx={chipIconSx(isActive)} />
                            <Typography level="body-xs" sx={chipLabelSx(isActive)}>
                                {t.chat.sidebar[filter.labelKey]}
                            </Typography>
                        </Clickable>
                    );
                })}

                {/* "Custom" menu trigger — sits at the end of the same
                    chip row. Active when any chip is selected; the
                    badge shows the selection count. The menu body
                    iterates `CHIP_ORDER` (semantic grouping) and
                    toggles via the parent-supplied setter. */}
                <Dropdown>
                    <MenuButton
                        slots={{ root: BoxSlotRoot }}
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
                                    background: isDark
                                        ? "var(--gp-brandalt-400)"
                                        : "var(--gp-brand-700)",
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
                    <MenuSurface
                        placement="bottom-start"
                        sx={{ maxHeight: 400, minWidth: 200 }}
                        zIndex={10010}
                    >
                        {CHIP_ORDER.map((id) => {
                            const meta = CHIP_META[id];
                            const Icon = meta.icon;
                            return (
                                // Stays open so users can toggle several chips in one go.
                                <MenuRow
                                    key={id}
                                    icon={<Icon />}
                                    selected={selectedChipIds.has(id)}
                                    keepOpen
                                    onClick={() => toggleChip(id)}
                                >
                                    {t.chat.sidebar[meta.labelKey]}
                                </MenuRow>
                            );
                        })}
                        {hasSelection && <MenuDivider />}
                        {hasSelection && (
                            <MenuRow accent onClick={() => setSelectedChipIds(new Set())}>
                                {t.chat.sidebar.chipFilterClear}
                            </MenuRow>
                        )}
                    </MenuSurface>
                </Dropdown>

                {/* "By name" refinement — visible only while at least
                    one of project / dm / gm / mdm is selected in the
                    Custom menu above. Lists chat instances of the
                    gated types so the user can narrow further to
                    specific chats (e.g. only the Kraken project, or
                    just Alice's DM). Auto-clears upstream when the
                    gating chips disappear. */}
                {showInstanceFilter && (
                    <Dropdown>
                        <MenuButton
                            slots={{ root: BoxSlotRoot }}
                            slotProps={{
                                root: {
                                    "aria-label": t.chat.sidebar.chipFilterByNameLabel,
                                    sx: chipButtonSx(hasInstanceSelection),
                                },
                            }}
                        >
                            <LabelOutlinedIcon sx={chipIconSx(hasInstanceSelection)} />
                            <Typography level="body-xs" sx={chipLabelSx(hasInstanceSelection)}>
                                {t.chat.sidebar.chipFilterByNameLabel}
                            </Typography>
                            {hasInstanceSelection && (
                                <Box
                                    sx={{
                                        alignItems: "center",
                                        background: isDark
                                            ? "var(--gp-brandalt-400)"
                                            : "var(--gp-brand-700)",
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
                                    {selectedInstanceIds.size}
                                </Box>
                            )}
                        </MenuButton>
                        <MenuSurface
                            placement="bottom-start"
                            sx={{ maxHeight: 400, minWidth: 220 }}
                            zIndex={10010}
                        >
                            {gatedChats.length === 0 && (
                                <MenuRow disabled>{t.chat.sidebar.chipFilterByNameEmpty}</MenuRow>
                            )}
                            {orderedGroups.map((chatType, idx) => {
                                const headerChipId = CHATTYPE_HEADER_CHIP[chatType];
                                const headerMeta = headerChipId
                                    ? CHIP_META[headerChipId]
                                    : undefined;
                                const HeaderIcon = headerMeta?.icon;
                                const chats = chatsByType.get(chatType) ?? [];
                                return (
                                    <Fragment key={chatType}>
                                        {showGroupHeaders && headerMeta && (
                                            <MenuGroupLabel>
                                                <Box
                                                    sx={{
                                                        alignItems: "center",
                                                        display: "flex",
                                                        gap: 0.5,
                                                    }}
                                                >
                                                    {HeaderIcon && (
                                                        <HeaderIcon sx={{ fontSize: 12 }} />
                                                    )}
                                                    {t.chat.sidebar[headerMeta.labelKey]}
                                                </Box>
                                            </MenuGroupLabel>
                                        )}
                                        {chats.map((chat) => {
                                            // PUNCH LIST (v3 chatId migration):
                                            // `chat.chatId` is `string` post-flip;
                                            // `makeInstanceKey` still keys by
                                            // numeric chatId (legacy lookup).
                                            // Cast once at the boundary.
                                            const key = makeInstanceKey(
                                                chat.chatType,
                                                chat.chatId as unknown as number
                                            );
                                            const RowIcon = headerMeta?.icon;
                                            return (
                                                // Keeps the menu open across multi-toggles.
                                                <MenuRow
                                                    key={key}
                                                    icon={RowIcon ? <RowIcon /> : undefined}
                                                    selected={selectedInstanceIds.has(key)}
                                                    keepOpen
                                                    onClick={() => toggleInstance(key)}
                                                >
                                                    <Box
                                                        sx={{
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {resolveChatDisplayName(chat) ||
                                                            `#${chat.chatId}`}
                                                    </Box>
                                                </MenuRow>
                                            );
                                        })}
                                        {showGroupHeaders && idx < orderedGroups.length - 1 && (
                                            <MenuDivider />
                                        )}
                                    </Fragment>
                                );
                            })}
                            {hasInstanceSelection && <MenuDivider />}
                            {hasInstanceSelection && (
                                <MenuRow accent onClick={() => setSelectedInstanceIds(new Set())}>
                                    {t.chat.sidebar.chipFilterClear}
                                </MenuRow>
                            )}
                        </MenuSurface>
                    </Dropdown>
                )}

                {/* "By group" refinement — visible only while the
                    `mention` chip is active in the Custom menu. Lists
                    every mention-group from `useMentionGroupsContext`;
                    selections AND-compose with the chip filter and any
                    "By name" instance refinement. Auto-clears upstream
                    when the gating chip is deselected. */}
                {showMentionGroupFilter && (
                    <Dropdown>
                        <MenuButton
                            slots={{ root: BoxSlotRoot }}
                            slotProps={{
                                root: {
                                    "aria-label": t.chat.sidebar.chipFilterByGroupLabel,
                                    sx: chipButtonSx(hasMentionGroupSelection),
                                },
                            }}
                        >
                            <LabelOutlinedIcon sx={chipIconSx(hasMentionGroupSelection)} />
                            <Typography level="body-xs" sx={chipLabelSx(hasMentionGroupSelection)}>
                                {t.chat.sidebar.chipFilterByGroupLabel}
                            </Typography>
                            {hasMentionGroupSelection && (
                                <Box
                                    sx={{
                                        alignItems: "center",
                                        background: isDark
                                            ? "var(--gp-brandalt-400)"
                                            : "var(--gp-brand-700)",
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
                                    {selectedMentionGroupIds.size}
                                </Box>
                            )}
                        </MenuButton>
                        <MenuSurface
                            placement="bottom-start"
                            sx={{ maxHeight: 400, minWidth: 220 }}
                            zIndex={10010}
                        >
                            {sortedMentionGroups.length === 0 && (
                                <MenuRow disabled>{t.chat.sidebar.chipFilterByGroupEmpty}</MenuRow>
                            )}
                            {sortedMentionGroups.map((group) => (
                                // Keeps the menu open across multi-toggles.
                                <MenuRow
                                    key={group.groupId}
                                    icon={<AlternateEmailRoundedIcon />}
                                    selected={selectedMentionGroupIds.has(group.groupId)}
                                    keepOpen
                                    onClick={() => toggleMentionGroup(group.groupId)}
                                >
                                    <Box
                                        sx={{
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {group.groupName}
                                    </Box>
                                </MenuRow>
                            ))}
                            {hasMentionGroupSelection && <MenuDivider />}
                            {hasMentionGroupSelection && (
                                <MenuRow
                                    accent
                                    onClick={() => setSelectedMentionGroupIds(new Set())}
                                >
                                    {t.chat.sidebar.chipFilterClear}
                                </MenuRow>
                            )}
                        </MenuSurface>
                    </Dropdown>
                )}
            </Stack>
        </Box>
    );
};
