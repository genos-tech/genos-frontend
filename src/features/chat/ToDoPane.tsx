import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Button, Chip, IconButton, Stack, Typography, useColorScheme } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { ModalManageTodoTags } from "./components/todo/ModalManageTodoTags";
import { ModalScheduledTodos } from "./components/todo/ModalScheduledTodos";
import { TodoMentionsProvider } from "./components/todo/titleMentions";
import { TodoGroupCard } from "./components/todo/TodoGroupCard";
import { TodoHostLayerProvider } from "./components/todo/TodoHostLayer";
import { TodoTagFilterBar } from "./components/todo/TodoTagFilterBar";
import {
    countCompletedToday,
    isCompletedToday,
    selectCompletedToday,
} from "./utils/todoCompletion";
import {
    filterGroupsByTags,
    itemTagKey,
    pruneTagFilter,
    readTagFilter,
    TagFilterKey,
    writeTagFilter,
} from "./utils/todoTagFilter";

import { FAB_CLEARANCE_COMPONENTS } from "../../components/layout/FabClearanceFooter";
import { AppTooltip } from "../../components/ui/AppTooltip";
import { EmptyState } from "../../components/ui/feedback/EmptyState";
import { modalChromeEndPadding } from "../../components/ui/modal/modalChrome";
import {
    chipRowTouchSx,
    compactChipRowTouchSx,
    touchTargetSx,
} from "../../components/ui/touchTargets";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UseTodoGroupsState } from "../../hooks/useTodoGroups";
import { fmt, useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { TodoGroupProps } from "../../types/chat";
import { getLocalCurrentDate, getLocalTomorrowDate } from "../../utils/dateUtils";

type ToDoPaneProps = {
    useCM: ChatManagementState;
    myself: UserProps;
    useTEM: TeamManagementState;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useUISM: UIStateManagementState;
    useTG: UseTodoGroupsState;
    // True when rendered inside UrlLinkModal (ModalTodoView): the pane
    // fills its container (`height: 100%`) rather than sharing a flex column
    // with a header above it.
    hostedInModal?: boolean;
    // The layer that modal sits at. The pane's own dialogs and menus open above
    // it (without this they opened at their usual layers, behind the modal).
    hostZIndex?: number;
    // Deep-link target: scroll the owning group into view and highlight
    // the item (highlight threads down to TodoItemRow).
    focusTarget?: { localDate: string; itemId?: number };
};

export const ToDoPane = (props: ToDoPaneProps) => {
    const {
        useCM,
        myself,
        useTEM,
        setMyself,
        socket,
        useUISM,
        useTG,
        hostedInModal = false,
        hostZIndex,
        focusTarget: focusTargetProp,
    } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    // Below `md`, the app-wide mobile cut-off. Only the header reads it.
    const isMobile = useIsMobile();

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);

    // Page-mode deep-link target. A pasted /workspace/todo/... URL (or a
    // Spotlight todo click) routes to the self-DM page — App can't prop-
    // drill the target through the keep-alive ChatHome tree, so it hands
    // it over via sessionStorage (pane not mounted yet on a fresh load)
    // and the `openTodoPane` event detail (pane already mounted). The
    // modal instance gets its target as a prop and skips both channels.
    const [routedFocusTarget, setRoutedFocusTarget] = useState<{
        localDate: string;
        itemId?: number;
    } | null>(() => {
        if (hostedInModal) return null;
        const raw = sessionStorage.getItem("todoDeepLinkTarget");
        if (!raw) return null;
        sessionStorage.removeItem("todoDeepLinkTarget");
        try {
            return JSON.parse(raw) as { localDate: string; itemId?: number };
        } catch {
            return null;
        }
    });
    useEffect(() => {
        if (hostedInModal) return;
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as
                | { localDate?: string; itemId?: number }
                | null
                | undefined;
            if (detail?.localDate) {
                setRoutedFocusTarget({ itemId: detail.itemId, localDate: detail.localDate });
                sessionStorage.removeItem("todoDeepLinkTarget");
            }
        };
        window.addEventListener("openTodoPane", handler);
        return () => window.removeEventListener("openTodoPane", handler);
    }, [hostedInModal]);

    const focusTarget = focusTargetProp ?? routedFocusTarget ?? undefined;

    const {
        groups,
        categories,
        schedules,
        incompleteCount,
        addItem,
        patchItem,
        moveItem,
        removeItem,
        addCategory,
        updateCategory,
        removeCategory,
        addSchedule,
        updateSchedule,
        removeSchedule,
        reminderByItemId,
        setItemReminder,
        cancelItemReminder,
    } = useTG;

    // Delete is an Undo toast, not a question (MIP-1300): the to-do leaves at once
    // and the real DELETE is sent when the window ends.
    const handleDeleteItem = useCallback(
        (itemId: number) =>
            removeItem(itemId, {
                message: t.chat.todoPane.itemDeleted,
                errorMessage: t.chat.todoPane.itemDeleteFailed,
            }),
        [removeItem, t]
    );

    // Scheduled-todos modal (recurring rules that auto-populate today).
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [tagsModalOpen, setTagsModalOpen] = useState(false);

    // "Completed Today" is a LOCAL third mode rather than a third value on
    // `useCM.showOnlyInCompleteTodos`. That flag is shared state which
    // `ModalTodoView` pre-seeds and the deep-link tab-flip below writes to,
    // so widening it to a tri-state would ripple through both for a view
    // neither of them needs. Instead it overrides the pair when on, and
    // All / Incomplete keep driving the shared boolean exactly as before.
    const [showCompletedToday, setShowCompletedToday] = useState(false);

    // Apply the filter chips — these operate on groups: a group is hidden
    // if it has no items left after filtering. On Incomplete, a group with
    // zero items still shows so the user can add to today; on Completed
    // Today it doesn't, because an "add" affordance is noise on a view
    // whose whole job is reviewing what's already done.
    //
    // Tomorrow keeps its empty card for the same reason today does: it's a
    // day you can still add to. Without it, starting tomorrow's list and
    // then completing the placeholder would make the whole card disappear
    // from the Incomplete tab, taking the only place to add to it with it.
    // The tag filter (MIP-584) narrows the items first, so the chips below it
    // (All / Incomplete / Completed today) each apply to what the tags left.
    // Their counts stay the whole list's, like a filter row's usually do.
    const [tagFilter, setTagFilterState] = useState<Set<TagFilterKey>>(readTagFilter);
    const setTagFilter = (next: Set<TagFilterKey>) => {
        setTagFilterState(next);
        writeTagFilter(next);
    };
    // A tag deleted since the filter was saved can't be un-picked from the bar,
    // so it would filter the list for ever. Dropped as soon as the tags load.
    useEffect(() => {
        if (categories.length === 0) return;
        setTagFilterState((prev) => {
            const pruned = pruneTagFilter(prev, categories);
            if (pruned.size === prev.size) return prev;
            writeTagFilter(pruned);
            return pruned;
        });
    }, [categories]);
    const toggleTag = (key: TagFilterKey) => {
        const next = new Set(tagFilter);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setTagFilter(next);
    };

    const tagFilteredGroups = useMemo(
        () => filterGroupsByTags(groups, tagFilter),
        [groups, tagFilter]
    );

    const displayGroups = useMemo(() => {
        if (showCompletedToday) return selectCompletedToday(tagFilteredGroups);
        if (!useCM.showOnlyInCompleteTodos) return tagFilteredGroups;
        const openDays = new Set([getLocalCurrentDate(), getLocalTomorrowDate()]);
        return tagFilteredGroups
            .map((g) => ({ ...g, items: g.items.filter((i) => !i.isCompleted) }))
            .filter((g) => g.items.length > 0 || openDays.has(g.localDate));
    }, [tagFilteredGroups, useCM.showOnlyInCompleteTodos, showCompletedToday]);

    const totalItems = useMemo(() => groups.reduce((a, g) => a + g.items.length, 0), [groups]);
    const completedItems = totalItems - incompleteCount;
    const completedTodayCount = useMemo(() => countCompletedToday(groups), [groups]);

    const handleCreateTodayGroup = async () => {
        // Add an empty "Untitled todo" placeholder for today, opening the
        // pane for editing. Matches the "+ New Todo" affordance.
        await addItem({
            localDate: getLocalCurrentDate(),
            title: t.chat.todoPane.untitled,
        });
    };

    const handleAddItem = async (localDate: string, title: string, categoryId: number | null) => {
        await addItem({ localDate, title, categoryId });
    };

    const handleAddSubitem = async (localDate: string, parentItemId: number, title: string) => {
        // Server ignores categoryId on children — pass null and let it
        // mirror the parent's tag.
        await addItem({ localDate, title, categoryId: null, parentItemId });
    };

    const handleCreateTomorrowGroup = async () => {
        // The mirror of the today button: tomorrow's list has to be startable
        // before tomorrow arrives, both for the leftovers of today and for
        // anything you already know belongs there.
        await addItem({
            localDate: getLocalTomorrowDate(),
            title: t.chat.todoPane.untitled,
        });
    };

    const handleMoveToTomorrow = (itemId: number) => {
        void moveItem(itemId, getLocalTomorrowDate());
    };

    const todayExists = groups.some((g) => g.localDate === getLocalCurrentDate());
    const tomorrowExists = groups.some((g) => g.localDate === getLocalTomorrowDate());
    // On a phone the header has one add icon, not a labelled "Start today" button (MIP-1219):
    // it starts today while today has no list, and tomorrow once today has one. Desktop keeps
    // its labelled "Start today" and the "Start tomorrow" icon, each on its own gate.
    const phoneStartDay: "today" | "tomorrow" | null = !todayExists
        ? "today"
        : !tomorrowExists
          ? "tomorrow"
          : null;
    const startIconDay: "today" | "tomorrow" | null = isMobile
        ? phoneStartDay
        : !tomorrowExists
          ? "tomorrow"
          : null;

    // Deep-link: bring the target group into the viewport. Prefer the
    // group that actually CONTAINS the item (belt-and-braces against the
    // URL's date drifting from the item's real group), falling back to
    // the localDate match for item-less date links. TodoItemRow then
    // fine-centers the exact row via scrollIntoView.
    const focusGroupIndex = useMemo(() => {
        if (!focusTarget) return -1;
        if (focusTarget.itemId != null) {
            const byItem = displayGroups.findIndex((g) =>
                g.items.some((i) => i.itemId === focusTarget.itemId)
            );
            if (byItem !== -1) return byItem;
        }
        return displayGroups.findIndex((g) => g.localDate === focusTarget.localDate);
    }, [displayGroups, focusTarget]);

    useEffect(() => {
        if (focusGroupIndex < 0) return;
        virtuosoRef.current?.scrollToIndex({ align: "start", index: focusGroupIndex });
    }, [focusGroupIndex]);

    // A completed target is invisible on the Incomplete tab — flip to
    // All so the highlight can actually be seen. Once per target (the
    // ref guard), so the user can still switch back to Incomplete
    // afterwards without us fighting them. In the modal the tab is
    // pre-initialized by ModalTodoView, making this a no-op there.
    const tabFlipHandledRef = useRef<string | null>(null);
    useEffect(() => {
        if (!focusTarget || focusTarget.itemId == null) return;
        const key = `${focusTarget.localDate}:${focusTarget.itemId}`;
        if (tabFlipHandledRef.current === key) return;
        const item = groups.flatMap((g) => g.items).find((i) => i.itemId === focusTarget.itemId);
        if (!item) return; // groups still loading — retry on next change
        tabFlipHandledRef.current = key;
        if (item.isCompleted && useCM.showOnlyInCompleteTodos) {
            useCM.setShowOnlyInCompleteTodos(false);
        }
        // The target may also be invisible on Completed Today (completed
        // on an earlier day, or not completed at all) — drop back to All
        // so the highlight is actually reachable.
        if (showCompletedToday && !isCompletedToday(item)) {
            setShowCompletedToday(false);
        }
        // And on a tag filter that hides it: the jump must not land on nothing.
        if (tagFilter.size > 0 && !tagFilter.has(itemTagKey(item, groups))) {
            setTagFilter(new Set());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusTarget, groups, useCM.showOnlyInCompleteTodos]);

    return (
        // Builds the @/# candidate pool once for every title field in the
        // pane — the add-item inputs, each row's title editor, and the
        // schedule modal below. See `TodoMentionsProvider`.
        <TodoHostLayerProvider value={hostedInModal ? hostZIndex : undefined}>
            <TodoMentionsProvider>
                <Box
                    sx={{
                        // The pane takes what is left in its column after the chat
                        // header (and the retention banner when it shows), as it
                        // always did on mobile. On desktop it asked for
                        // `100dvh - 64px`, which is only right while the pane is alone
                        // in a full-height column: in a split view it is taller than
                        // its half and its bottom runs off the window. `minHeight: 0`
                        // lets it shrink below its content so the list scrolls. The
                        // modal has no such column, so it fills its container.
                        ...(hostedInModal ? { height: "100%" } : { flex: 1, minHeight: 0 }),
                        display: "flex",
                        flexDirection: "column",
                        background: isDark
                            ? "linear-gradient(180deg, rgba(30,30,35,0.4) 0%, transparent 100%)"
                            : "linear-gradient(180deg, rgba(245,247,250,0.8) 0%, transparent 100%)",
                    }}
                >
                    {/* Header */}
                    <Box
                        sx={{
                            px: 2.5,
                            // A phone header is short: the list under it is the page.
                            pt: isMobile ? 1 : 2,
                            pb: isMobile ? 1 : 1.5,
                            borderBottom: isDark
                                ? "1px solid rgba(255,255,255,0.06)"
                                : "1px solid rgba(0,0,0,0.06)",
                        }}
                    >
                        <Stack
                            alignItems="center"
                            direction="row"
                            justifyContent="space-between"
                            mb={isMobile ? 0.5 : 1.5}
                            // In a modal the "open full page" and ✕ buttons float over
                            // this corner (UrlLinkModal publishes how much: ui/modal/
                            // modalChrome). MIP-1044 kept it clear of the actions; on a
                            // phone the row does not fit beside the title and the
                            // clearance together, so there the actions wrap to their own
                            // line and only the title line keeps the corner free
                            // (MIP-1296). The page header wraps on a phone too (MIP-1319):
                            // 44px actions beside the title squeeze it to two lines ("My" /
                            // "Todos") where the row is narrow, so there the actions drop
                            // under it only when they do not fit. On a desktop page
                            // nothing changes.
                            data-todo-header-row
                            sx={
                                isMobile
                                    ? { flexWrap: "wrap", rowGap: 1 }
                                    : hostedInModal
                                      ? modalChromeEndPadding()
                                      : undefined
                            }
                        >
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={1.5}
                                sx={
                                    isMobile
                                        ? hostedInModal
                                            ? {
                                                  flexBasis: "100%",
                                                  minWidth: 0,
                                                  ...modalChromeEndPadding(),
                                              }
                                            : // On the page the title shares the line with the actions
                                              // while it fits, and the actions drop below it when it
                                              // does not (a longer locale, a narrower phone).
                                              { minWidth: 0 }
                                        : undefined
                                }
                            >
                                <Box
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "10px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: isDark
                                            ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.2) 0%, rgba(var(--gp-brandalt-500-rgb), 0.2) 100%)"
                                            : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.12) 0%, rgba(var(--gp-brandalt-500-rgb), 0.12) 100%)",
                                    }}
                                >
                                    <TaskAltRoundedIcon
                                        sx={{
                                            fontSize: 20,
                                            color: isDark
                                                ? "var(--gp-brandalt-400)"
                                                : "var(--gp-brand-700)",
                                        }}
                                    />
                                </Box>
                                <Stack spacing={0}>
                                    <Typography
                                        level="title-lg"
                                        sx={{
                                            fontWeight: 700,
                                            fontSize: "1.1rem",
                                            color: isDark
                                                ? "rgba(255,255,255,0.92)"
                                                : "rgba(0,0,0,0.85)",
                                            letterSpacing: "-0.01em",
                                        }}
                                    >
                                        {t.chat.todoPane.myTodos}
                                    </Typography>
                                    {/* The "N of M items completed" line is a
                                    second row under the title; it is left
                                    out on a phone to keep the header short
                                    (the filter chips below show counts). */}
                                    {!isMobile && (
                                        <Typography
                                            level="body-xs"
                                            sx={{
                                                color: isDark
                                                    ? "rgba(255,255,255,0.45)"
                                                    : "rgba(0,0,0,0.45)",
                                                fontSize: "0.75rem",
                                            }}
                                        >
                                            {fmt(t.chat.todoPane.completedOfTotal, {
                                                completed: completedItems,
                                                total: totalItems,
                                            })}
                                        </Typography>
                                    )}
                                </Stack>
                            </Stack>

                            {/* Right-hand action cluster: repeat (always visible) +
                        Start today (only when today's group is empty/absent). */}
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={1}
                                // 44px touch targets, in the dialog (MIP-1296) and on the page
                                // (MIP-1319); the Start today button too.
                                sx={touchTargetSx("& .MuiIconButton-root, & .MuiButton-root")}
                            >
                                <AppTooltip title={t.chat.todoPane.tags.manageTooltip}>
                                    <IconButton
                                        aria-label={t.chat.todoPane.tags.manageTooltip}
                                        size="sm"
                                        sx={{
                                            borderRadius: "10px",
                                            color: isDark
                                                ? "var(--gp-brandalt-400)"
                                                : "var(--gp-brand-700)",
                                            background: isDark
                                                ? "rgba(var(--gp-brand-700-rgb), 0.15)"
                                                : "rgba(var(--gp-brand-700-rgb), 0.1)",
                                            "&:hover": {
                                                background: isDark
                                                    ? "rgba(var(--gp-brand-700-rgb), 0.25)"
                                                    : "rgba(var(--gp-brand-700-rgb), 0.18)",
                                            },
                                        }}
                                        onClick={() => setTagsModalOpen(true)}
                                    >
                                        <LocalOfferOutlinedIcon sx={{ fontSize: "18px" }} />
                                    </IconButton>
                                </AppTooltip>

                                <AppTooltip title={t.chat.todoPane.schedule.tooltip}>
                                    <IconButton
                                        size="sm"
                                        sx={{
                                            borderRadius: "10px",
                                            color: isDark
                                                ? "var(--gp-brandalt-400)"
                                                : "var(--gp-brand-700)",
                                            background: isDark
                                                ? "rgba(var(--gp-brand-700-rgb), 0.15)"
                                                : "rgba(var(--gp-brand-700-rgb), 0.1)",
                                            "&:hover": {
                                                background: isDark
                                                    ? "rgba(var(--gp-brand-700-rgb), 0.25)"
                                                    : "rgba(var(--gp-brand-700-rgb), 0.18)",
                                            },
                                        }}
                                        onClick={() => setScheduleModalOpen(true)}
                                    >
                                        <RepeatRoundedIcon sx={{ fontSize: "18px" }} />
                                    </IconButton>
                                </AppTooltip>

                                {/* "New Todo" button — only when today's group is empty/absent.
                            Desktop only: a phone gets the one add icon below. */}
                                {!isMobile && !todayExists && (
                                    <AppTooltip title={t.chat.todoPane.createTodayTooltip}>
                                        <Button
                                            size="sm"
                                            startDecorator={<AddIcon sx={{ fontSize: "18px" }} />}
                                            onClick={handleCreateTodayGroup}
                                        >
                                            {t.chat.todoPane.startToday}
                                        </Button>
                                    </AppTooltip>
                                )}

                                {/* The add icon. Desktop: "Start tomorrow", same gate as
                            today's, so a day that already has a list doesn't offer to
                            create it again. Phone: "Start today" until today has a
                            list, then "Start tomorrow". Icon-only at every width (MIP-1051):
                            tomorrow is the secondary of the two, and a second
                            labelled button made the header crowded. The tooltip
                            and aria-label carry the name. */}
                                {startIconDay && (
                                    <AppTooltip
                                        title={
                                            startIconDay === "today"
                                                ? t.chat.todoPane.createTodayTooltip
                                                : t.chat.todoPane.createTomorrowTooltip
                                        }
                                    >
                                        <IconButton
                                            aria-label={
                                                startIconDay === "today"
                                                    ? t.chat.todoPane.startToday
                                                    : t.chat.todoPane.startTomorrow
                                            }
                                            size="sm"
                                            sx={{
                                                borderRadius: "10px",
                                                px: 0,
                                                py: 0,
                                                border: "1px solid",
                                                borderColor: isDark
                                                    ? "rgba(var(--gp-brandalt-400-rgb), 0.4)"
                                                    : "rgba(var(--gp-brand-700-rgb), 0.3)",
                                                color: isDark
                                                    ? "var(--gp-brandalt-400)"
                                                    : "var(--gp-brand-700)",
                                                "&:hover": {
                                                    background: isDark
                                                        ? "rgba(var(--gp-brandalt-400-rgb), 0.12)"
                                                        : "rgba(var(--gp-brand-700-rgb), 0.08)",
                                                },
                                            }}
                                            onClick={
                                                startIconDay === "today"
                                                    ? handleCreateTodayGroup
                                                    : handleCreateTomorrowGroup
                                            }
                                        >
                                            <AddIcon sx={{ fontSize: "18px" }} />
                                        </IconButton>
                                    </AppTooltip>
                                )}
                            </Stack>
                        </Stack>

                        {/* Filter row */}
                        <Stack alignItems="center" direction="row" justifyContent="space-between">
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={1}
                                sx={isMobile ? compactChipRowTouchSx : chipRowTouchSx}
                            >
                                <Chip
                                    size="sm"
                                    sx={{ cursor: "pointer", borderRadius: "6px" }}
                                    variant={
                                        !showCompletedToday && !useCM.showOnlyInCompleteTodos
                                            ? "solid"
                                            : "soft"
                                    }
                                    onClick={() => {
                                        setShowCompletedToday(false);
                                        useCM.setShowOnlyInCompleteTodos(false);
                                    }}
                                >
                                    {fmt(t.chat.todoPane.allFilter, { count: totalItems })}
                                </Chip>
                                <Chip
                                    color="warning"
                                    size="sm"
                                    sx={{ cursor: "pointer", borderRadius: "6px" }}
                                    startDecorator={
                                        <FilterListRoundedIcon sx={{ fontSize: 14 }} />
                                    }
                                    variant={
                                        !showCompletedToday && useCM.showOnlyInCompleteTodos
                                            ? "solid"
                                            : "soft"
                                    }
                                    onClick={() => {
                                        setShowCompletedToday(false);
                                        useCM.setShowOnlyInCompleteTodos(true);
                                    }}
                                >
                                    {fmt(t.chat.todoPane.incompleteFilter, {
                                        count: incompleteCount,
                                    })}
                                </Chip>
                                <Chip
                                    color="success"
                                    size="sm"
                                    startDecorator={<TaskAltRoundedIcon sx={{ fontSize: 14 }} />}
                                    sx={{ cursor: "pointer", borderRadius: "6px" }}
                                    variant={showCompletedToday ? "solid" : "soft"}
                                    onClick={() => setShowCompletedToday(true)}
                                >
                                    {fmt(t.chat.todoPane.completedTodayFilter, {
                                        count: completedTodayCount,
                                    })}
                                </Chip>
                            </Stack>
                        </Stack>
                        <TodoTagFilterBar
                            categories={categories}
                            compact={isMobile}
                            isDark={isDark}
                            selected={tagFilter}
                            onClear={() => setTagFilter(new Set())}
                            onToggle={toggleTag}
                        />
                    </Box>

                    {/* Group list */}
                    {/* minHeight: 0 — without it a flex child refuses to shrink
                below its content, so the `height: 100%` list above would
                overflow the pane instead of fitting it. */}
                    <Box sx={{ flex: 1, minHeight: 0, py: 0.5, overflow: "hidden" }}>
                        {displayGroups.length > 0 ? (
                            <Virtuoso
                                ref={virtuosoRef}
                                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                                components={FAB_CLEARANCE_COMPONENTS}
                                totalCount={displayGroups.length}
                                initialTopMostItemIndex={
                                    focusGroupIndex >= 0 ? focusGroupIndex : 0
                                }
                                itemContent={(index) => {
                                    const group = displayGroups[index] as TodoGroupProps;
                                    return (
                                        <TodoGroupCard
                                            key={`todo-group-${group.groupId}`}
                                            categories={categories}
                                            group={group}
                                            highlightItemId={focusTarget?.itemId}
                                            myself={myself}
                                            reminderByItemId={reminderByItemId}
                                            setMyself={setMyself}
                                            socket={socket}
                                            tagFilter={tagFilter}
                                            useCM={useCM}
                                            useTEM={useTEM}
                                            useUISM={useUISM}
                                            onAddItem={handleAddItem}
                                            onAddSubitem={handleAddSubitem}
                                            onCancelReminder={cancelItemReminder}
                                            onCategoryCreate={addCategory}
                                            onDeleteItem={handleDeleteItem}
                                            onMoveToTomorrow={handleMoveToTomorrow}
                                            onPatchItem={patchItem}
                                            onSetReminder={setItemReminder}
                                        />
                                    );
                                }}
                                style={{
                                    // Fill the wrapper above, which takes what the pane
                                    // has left after its header. This was
                                    // `currentWindowHeight - 250` (x 0.43 in a split
                                    // view), the 250 being the chat header + pane
                                    // header + footer added up by hand; the tag filter
                                    // bar made the header taller than that sum and the
                                    // list ran past the box that clips it.
                                    // The mobile keyboard still shortens it: it
                                    // inflates `--mobile-bottom-inset`, which shortens
                                    // the app's outer wrapper.
                                    height: "100%",
                                }}
                            />
                        ) : (
                            <TodoEmpty
                                showCompletedToday={showCompletedToday}
                                showIncompleteOnly={useCM.showOnlyInCompleteTodos}
                                onAddTodayClick={handleCreateTodayGroup}
                            />
                        )}
                    </Box>

                    <ModalManageTodoTags
                        categories={categories}
                        open={tagsModalOpen}
                        onClose={() => setTagsModalOpen(false)}
                        onCreate={addCategory}
                        onDelete={removeCategory}
                        onUpdate={updateCategory}
                    />

                    <ModalScheduledTodos
                        categories={categories}
                        myselfUserId={myself.userId}
                        open={scheduleModalOpen}
                        schedules={schedules}
                        onAdd={addSchedule}
                        onClose={() => setScheduleModalOpen(false)}
                        onRemove={removeSchedule}
                        onUpdate={updateSchedule}
                    />
                </Box>
            </TodoMentionsProvider>
        </TodoHostLayerProvider>
    );
};

interface TodoEmptyProps {
    showIncompleteOnly: boolean;
    showCompletedToday: boolean;
    onAddTodayClick: () => void;
}

const TodoEmpty = ({
    showIncompleteOnly,
    showCompletedToday,
    onAddTodayClick,
}: TodoEmptyProps) => {
    const { t } = useTranslation();
    return (
        <EmptyState
            data-empty="todo"
            icon={<CheckCircleOutlineRoundedIcon />}
            action={
                !showIncompleteOnly && !showCompletedToday
                    ? {
                          label: t.chat.todoPane.startToday,
                          onClick: onAddTodayClick,
                          icon: <AddIcon />,
                      }
                    : undefined
            }
            body={
                showCompletedToday
                    ? t.chat.todoPane.completedTodayEmptySubtitle
                    : showIncompleteOnly
                      ? t.chat.todoPane.incompleteEmptySubtitle
                      : t.chat.todoPane.emptySubtitle
            }
            title={
                showCompletedToday
                    ? t.chat.todoPane.completedTodayEmptyTitle
                    : showIncompleteOnly
                      ? t.chat.todoPane.allCaughtUp
                      : t.chat.todoPane.noTodosYet
            }
            fill
        />
    );
};
