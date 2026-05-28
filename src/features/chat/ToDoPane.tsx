import { useMemo, useRef } from "react";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import TipsAndUpdatesRoundedIcon from "@mui/icons-material/TipsAndUpdatesRounded";
import { Box, Chip, IconButton, Stack, Tooltip, Typography, useColorScheme } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { TodoGroupCard } from "./components/todo/TodoGroupCard";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UseTodoGroupsState } from "../../hooks/useTodoGroups";
import { useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { TodoGroupProps } from "../../types/chat";
import { getLocalCurrentDate } from "../../utils/dateUtils";

type ToDoPaneProps = {
    useCM: ChatManagementState;
    myself: UserProps;
    useTEM: TeamManagementState;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useUISM: UIStateManagementState;
    useTG: UseTodoGroupsState;
    currentWindowHeight: number;
};

export const ToDoPane = (props: ToDoPaneProps) => {
    const { useCM, myself, useTEM, setMyself, socket, useUISM, useTG, currentWindowHeight } =
        props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);

    const { groups, categories, incompleteCount, addItem, patchItem, removeItem, addCategory } =
        useTG;

    // Apply the existing "Incomplete only" filter chip — now operates
    // on groups: a group is hidden if all items are completed (when the
    // chip is on). Groups with zero items still show so the user can
    // add to today.
    const displayGroups = useMemo(() => {
        if (!useCM.showOnlyInCompleteTodos) return groups;
        return groups
            .map((g) => ({ ...g, items: g.items.filter((i) => !i.isCompleted) }))
            .filter((g) => g.items.length > 0 || g.localDate === getLocalCurrentDate());
    }, [groups, useCM.showOnlyInCompleteTodos]);

    const totalItems = useMemo(() => groups.reduce((a, g) => a + g.items.length, 0), [groups]);
    const completedItems = totalItems - incompleteCount;

    const handleCreateTodayGroup = async () => {
        // Add an empty "Untitled todo" placeholder for today, opening the
        // pane for editing. Matches the "+ New Todo" affordance.
        await addItem({
            localDate: getLocalCurrentDate(),
            title: "Untitled todo",
        });
    };

    const handleAddItem = async (localDate: string, title: string, categoryId: number | null) => {
        await addItem({ localDate, title, categoryId });
    };

    const todayExists = groups.some((g) => g.localDate === getLocalCurrentDate());

    return (
        <Box
            sx={{
                height: "calc(100dvh - 64px)",
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
                <Stack alignItems="center" direction="row" justifyContent="space-between" mb={1.5}>
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
                                    ? "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(139,92,246,0.2) 100%)"
                                    : "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(139,92,246,0.12) 100%)",
                            }}
                        >
                            <TaskAltRoundedIcon
                                sx={{ fontSize: 20, color: isDark ? "#a78bfa" : "#7c3aed" }}
                            />
                        </Box>
                        <Stack spacing={0}>
                            <Typography
                                level="title-lg"
                                sx={{
                                    fontWeight: 700,
                                    fontSize: "1.1rem",
                                    color: isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.85)",
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {t.chat.todoPane.myTodos}
                            </Typography>
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                                    fontSize: "0.75rem",
                                }}
                            >
                                {completedItems} of {totalItems} items completed
                            </Typography>
                        </Stack>
                    </Stack>

                    {/* "New Todo" button — only when today's group is empty/absent. */}
                    {!todayExists && (
                        <Tooltip title="Create today's todo list">
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
                                        ? "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)"
                                        : "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
                                    color: "#fff",
                                    "&:hover": {
                                        background: isDark
                                            ? "linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)"
                                            : "linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)",
                                    },
                                }}
                                onClick={handleCreateTodayGroup}
                            >
                                <AddIcon sx={{ fontSize: "18px" }} />
                                Start today
                            </IconButton>
                        </Tooltip>
                    )}
                </Stack>

                {/* Filter row */}
                <Stack alignItems="center" direction="row" justifyContent="space-between">
                    <Stack alignItems="center" direction="row" spacing={1}>
                        <Chip
                            size="sm"
                            sx={{ cursor: "pointer", borderRadius: "6px" }}
                            variant={!useCM.showOnlyInCompleteTodos ? "solid" : "soft"}
                            onClick={() => useCM.setShowOnlyInCompleteTodos(false)}
                        >
                            All ({totalItems})
                        </Chip>
                        <Chip
                            size="sm"
                            startDecorator={<FilterListRoundedIcon sx={{ fontSize: 14 }} />}
                            sx={{ cursor: "pointer", borderRadius: "6px" }}
                            variant={useCM.showOnlyInCompleteTodos ? "solid" : "soft"}
                            onClick={() => useCM.setShowOnlyInCompleteTodos(true)}
                        >
                            Incomplete ({incompleteCount})
                        </Chip>
                    </Stack>
                </Stack>
            </Box>

            {/* Group list */}
            <Box sx={{ flex: 1, py: 0.5, overflow: "hidden" }}>
                {displayGroups.length > 0 ? (
                    <Virtuoso
                        ref={virtuosoRef}
                        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                        totalCount={displayGroups.length}
                        itemContent={(index) => {
                            const group = displayGroups[index] as TodoGroupProps;
                            return (
                                <TodoGroupCard
                                    key={`todo-group-${group.groupId}`}
                                    categories={categories}
                                    group={group}
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket}
                                    useCM={useCM}
                                    useTEM={useTEM}
                                    useUISM={useUISM}
                                    onAddItem={handleAddItem}
                                    onCategoryCreate={addCategory}
                                    onDeleteItem={removeItem}
                                    onPatchItem={patchItem}
                                />
                            );
                        }}
                        style={{
                            height: useCM.isSubChatVisible
                                ? `${(currentWindowHeight - 250) * 0.43}px`
                                : `${currentWindowHeight - 250}px`,
                        }}
                    />
                ) : (
                    <EmptyState
                        isDark={isDark}
                        showIncompleteOnly={useCM.showOnlyInCompleteTodos}
                        onAddTodayClick={handleCreateTodayGroup}
                    />
                )}
            </Box>

            {/* Pro Tip footer */}
            <Box
                sx={{
                    mt: "auto",
                    px: 2.5,
                    py: 2,
                    borderTop: "1px solid",
                    borderColor: isDark ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.1)",
                    background: isDark
                        ? "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(168,85,247,0.08) 100%)"
                        : "linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(168,85,247,0.06) 100%)",
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
                                ? "rgba(124,58,237,0.15)"
                                : "rgba(124,58,237,0.1)",
                        }}
                    >
                        <TipsAndUpdatesRoundedIcon
                            sx={{ fontSize: 22, color: isDark ? "#a78bfa" : "#7c3aed" }}
                        />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            level="title-sm"
                            sx={{
                                fontWeight: 600,
                                color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
                                mb: 0.25,
                            }}
                        >
                            {t.chat.todoPane.proTip}
                        </Typography>
                        <Typography
                            level="body-sm"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                            }}
                        >
                            Ask the agent: "what's left today?" or "create a todo: …" — the
                            Spotlight palette can read, add, and toggle your items directly.
                        </Typography>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
};

interface EmptyStateProps {
    showIncompleteOnly: boolean;
    onAddTodayClick: () => void;
    isDark: boolean;
}

const EmptyState = ({ showIncompleteOnly, onAddTodayClick, isDark }: EmptyStateProps) => {
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
                    {showIncompleteOnly ? "All caught up!" : "No todos yet"}
                </Typography>
                <Typography
                    level="body-xs"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                        textAlign: "center",
                        maxWidth: 240,
                    }}
                >
                    {showIncompleteOnly
                        ? "No incomplete items in your visible groups."
                        : "Create today's group to get started."}
                </Typography>
                {!showIncompleteOnly && (
                    <IconButton
                        size="sm"
                        sx={{ mt: 1, borderRadius: "8px", px: 1.5 }}
                        variant="soft"
                        onClick={onAddTodayClick}
                    >
                        <AddIcon sx={{ fontSize: 16, mr: 0.5 }} />
                        Start today
                    </IconButton>
                )}
            </Stack>
        </Stack>
    );
};
