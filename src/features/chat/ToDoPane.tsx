import { useEffect, useMemo, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import TipsAndUpdatesRoundedIcon from "@mui/icons-material/TipsAndUpdatesRounded";
import { Box, Chip, IconButton, Stack, Typography, useColorScheme } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { ModalScheduledTodos } from "./components/todo/ModalScheduledTodos";
import { TodoMentionsProvider } from "./components/todo/titleMentions";
import { TodoGroupCard } from "./components/todo/TodoGroupCard";
import {
    countCompletedToday,
    isCompletedToday,
    selectCompletedToday,
} from "./utils/todoCompletion";

import { AppTooltip } from "../../components/ui/AppTooltip";
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
    currentWindowHeight: number;
    // True when rendered inside UrlLinkModal (ModalTodoView): the pane
    // fills its container instead of the viewport math below, and the
    // Pro-Tip footer is dropped to give the list room.
    hostedInModal?: boolean;
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
        currentWindowHeight,
        hostedInModal = false,
        focusTarget: focusTargetProp,
    } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
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
        addSchedule,
        updateSchedule,
        removeSchedule,
        reminderByItemId,
        setItemReminder,
        cancelItemReminder,
    } = useTG;

    // Scheduled-todos modal (recurring rules that auto-populate today).
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

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
    const displayGroups = useMemo(() => {
        if (showCompletedToday) return selectCompletedToday(groups);
        if (!useCM.showOnlyInCompleteTodos) return groups;
        const openDays = new Set([getLocalCurrentDate(), getLocalTomorrowDate()]);
        return groups
            .map((g) => ({ ...g, items: g.items.filter((i) => !i.isCompleted) }))
            .filter((g) => g.items.length > 0 || openDays.has(g.localDate));
    }, [groups, useCM.showOnlyInCompleteTodos, showCompletedToday]);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusTarget, groups, useCM.showOnlyInCompleteTodos]);

    return (
        // Builds the @/# candidate pool once for every title field in the
        // pane — the add-item inputs, each row's title editor, and the
        // schedule modal below. See `TodoMentionsProvider`.
        <TodoMentionsProvider>
            <Box
                sx={{
                    // On mobile: no own height at all. The ancestors already
                    // subtract both the 64px chat header and the bottom tab
                    // bar (`outerWrapper` caps at 100dvh - --mobile-bottom-
                    // inset), so asking for `100dvh - 64px` here made this
                    // box about a tab-bar TALLER than the space it was given
                    // — and since the list below sized itself independently,
                    // the surplus showed up as dead gradient under the last
                    // card. `flex: 1` + `minHeight: 0` takes exactly the room
                    // left after the header/banner siblings instead.
                    ...(hostedInModal
                        ? { height: "100%" }
                        : isMobile
                          ? { flex: 1, minHeight: 0 }
                          : { height: "calc(100dvh - 64px)" }),
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
                        pt: 2,
                        pb: 1.5,
                        borderBottom: isDark
                            ? "1px solid rgba(255,255,255,0.06)"
                            : "1px solid rgba(0,0,0,0.06)",
                    }}
                >
                    <Stack
                        alignItems="center"
                        direction="row"
                        justifyContent="space-between"
                        mb={1.5}
                    >
                        <Stack alignItems="center" direction="row" spacing={1.5}>
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
                            </Stack>
                        </Stack>

                        {/* Right-hand action cluster: repeat (always visible) +
                        Start today (only when today's group is empty/absent). */}
                        <Stack alignItems="center" direction="row" spacing={1}>
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

                            {/* "New Todo" button — only when today's group is empty/absent. */}
                            {!todayExists && (
                                <AppTooltip title={t.chat.todoPane.createTodayTooltip}>
                                    <IconButton
                                        size="sm"
                                        sx={{
                                            borderRadius: "10px",
                                            px: 1.5,
                                            py: 0.75,
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            gap: 0.5,
                                            background: isDark
                                                ? "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brandalt-500) 100%)"
                                                : "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brandalt-500) 100%)",
                                            color: "#fff",
                                            "&:hover": {
                                                background: isDark
                                                    ? "linear-gradient(135deg, var(--gp-brand-800) 0%, var(--gp-brand-700) 100%)"
                                                    : "linear-gradient(135deg, var(--gp-brand-800) 0%, var(--gp-brand-700) 100%)",
                                            },
                                        }}
                                        onClick={handleCreateTodayGroup}
                                    >
                                        <AddIcon sx={{ fontSize: "18px" }} />
                                        {t.chat.todoPane.startToday}
                                    </IconButton>
                                </AppTooltip>
                            )}

                            {/* "Start tomorrow" — same gate as today's, so a
                            day that already has a list doesn't offer to
                            create it again. Outlined rather than the filled
                            gradient: tomorrow is the secondary of the two
                            when both are offered, and two identical filled
                            buttons side by side read as one control split in
                            half. */}
                            {!tomorrowExists && (
                                <AppTooltip title={t.chat.todoPane.createTomorrowTooltip}>
                                    <IconButton
                                        size="sm"
                                        sx={{
                                            borderRadius: "10px",
                                            px: 1.5,
                                            py: 0.75,
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            gap: 0.5,
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
                                        onClick={handleCreateTomorrowGroup}
                                    >
                                        <AddIcon sx={{ fontSize: "18px" }} />
                                        {t.chat.todoPane.startTomorrow}
                                    </IconButton>
                                </AppTooltip>
                            )}
                        </Stack>
                    </Stack>

                    {/* Filter row */}
                    <Stack alignItems="center" direction="row" justifyContent="space-between">
                        <Stack alignItems="center" direction="row" spacing={1}>
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
                                startDecorator={<FilterListRoundedIcon sx={{ fontSize: 14 }} />}
                                sx={{ cursor: "pointer", borderRadius: "6px" }}
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
                                {fmt(t.chat.todoPane.incompleteFilter, { count: incompleteCount })}
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
                            initialTopMostItemIndex={focusGroupIndex >= 0 ? focusGroupIndex : 0}
                            totalCount={displayGroups.length}
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
                                        useCM={useCM}
                                        useTEM={useTEM}
                                        useUISM={useUISM}
                                        onAddItem={handleAddItem}
                                        onAddSubitem={handleAddSubitem}
                                        onCancelReminder={cancelItemReminder}
                                        onCategoryCreate={addCategory}
                                        onDeleteItem={removeItem}
                                        onMoveToTomorrow={handleMoveToTomorrow}
                                        onPatchItem={patchItem}
                                        onSetReminder={setItemReminder}
                                    />
                                );
                            }}
                            style={{
                                // Mobile joins the modal on `100%`: the pane
                                // root is now a flex child sized by its
                                // container, and the wrapper Box below is
                                // `flex: 1, minHeight: 0`, so "fill the
                                // leftover" is exact — no viewport subtraction
                                // to drift out of step with the real chrome
                                // (which is what left dead space here).
                                // The keyboard is still handled: it inflates
                                // `--mobile-bottom-inset`, which shortens
                                // `outerWrapper`, which shortens this list.
                                // Split panes are desktop-only, so the 0.43
                                // branch can't apply on mobile.
                                height:
                                    hostedInModal || isMobile
                                        ? "100%"
                                        : useCM.isSubChatVisible
                                          ? `${(currentWindowHeight - 250) * 0.43}px`
                                          : `${currentWindowHeight - 250}px`,
                            }}
                        />
                    ) : (
                        <EmptyState
                            isDark={isDark}
                            showCompletedToday={showCompletedToday}
                            showIncompleteOnly={useCM.showOnlyInCompleteTodos}
                            onAddTodayClick={handleCreateTodayGroup}
                        />
                    )}
                </Box>

                {/* Pro Tip footer — dropped in the modal, and on mobile, to give
                the list room. It's a static hint about asking the agent; on a
                phone it costs a permanent band of a short screen to say
                something you only need to read once. */}
                {hostedInModal || isMobile ? null : (
                    <Box
                        sx={{
                            mt: "auto",
                            px: 2.5,
                            py: 2,
                            borderTop: "1px solid",
                            borderColor: isDark
                                ? "rgba(var(--gp-brand-700-rgb), 0.15)"
                                : "rgba(var(--gp-brand-700-rgb), 0.1)",
                            background: isDark
                                ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.08) 0%, rgba(var(--gp-brand-500-rgb), 0.08) 100%)"
                                : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.06) 0%, rgba(var(--gp-brand-500-rgb), 0.06) 100%)",
                        }}
                    >
                        <Stack alignItems="center" direction="row" spacing={2}>
                            <Box
                                sx={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: "10px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    backgroundColor: isDark
                                        ? "rgba(var(--gp-brand-700-rgb), 0.15)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.1)",
                                }}
                            >
                                <TipsAndUpdatesRoundedIcon
                                    sx={{
                                        fontSize: 22,
                                        color: isDark
                                            ? "var(--gp-brandalt-400)"
                                            : "var(--gp-brand-700)",
                                    }}
                                />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                    level="title-sm"
                                    sx={{
                                        fontWeight: 600,
                                        color: isDark
                                            ? "rgba(255,255,255,0.85)"
                                            : "rgba(0,0,0,0.8)",
                                        mb: 0.25,
                                    }}
                                >
                                    {t.chat.todoPane.proTip}
                                </Typography>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.55)"
                                            : "rgba(0,0,0,0.55)",
                                    }}
                                >
                                    {t.chat.todoPane.spotlightTip}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>
                )}

                <ModalScheduledTodos
                    categories={categories}
                    open={scheduleModalOpen}
                    schedules={schedules}
                    onAdd={addSchedule}
                    onClose={() => setScheduleModalOpen(false)}
                    onRemove={removeSchedule}
                    onUpdate={updateSchedule}
                />
            </Box>
        </TodoMentionsProvider>
    );
};

interface EmptyStateProps {
    showIncompleteOnly: boolean;
    showCompletedToday: boolean;
    onAddTodayClick: () => void;
    isDark: boolean;
}

const EmptyState = ({
    showIncompleteOnly,
    showCompletedToday,
    onAddTodayClick,
    isDark,
}: EmptyStateProps) => {
    const { t } = useTranslation();
    return (
        <Stack
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ height: "100%", py: 8 }}
        >
            <Box
                sx={{
                    width: 64,
                    height: 64,
                    borderRadius: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                }}
            >
                <CheckCircleOutlineRoundedIcon
                    sx={{
                        fontSize: 32,
                        color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
                    }}
                />
            </Box>
            <Stack alignItems="center" spacing={0.5}>
                <Typography
                    level="title-sm"
                    sx={{
                        fontWeight: 600,
                        color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                    }}
                >
                    {showCompletedToday
                        ? t.chat.todoPane.completedTodayEmptyTitle
                        : showIncompleteOnly
                          ? t.chat.todoPane.allCaughtUp
                          : t.chat.todoPane.noTodosYet}
                </Typography>
                <Typography
                    level="body-xs"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                        textAlign: "center",
                        maxWidth: 240,
                    }}
                >
                    {showCompletedToday
                        ? t.chat.todoPane.completedTodayEmptySubtitle
                        : showIncompleteOnly
                          ? t.chat.todoPane.incompleteEmptySubtitle
                          : t.chat.todoPane.emptySubtitle}
                </Typography>
                {!showIncompleteOnly && !showCompletedToday && (
                    <IconButton
                        size="sm"
                        sx={{ mt: 1, borderRadius: "8px", px: 1.5 }}
                        variant="soft"
                        onClick={onAddTodayClick}
                    >
                        <AddIcon sx={{ fontSize: 16, mr: 0.5 }} />
                        {t.chat.todoPane.startToday}
                    </IconButton>
                )}
            </Stack>
        </Stack>
    );
};
