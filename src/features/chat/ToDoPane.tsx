import { useEffect, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import TipsAndUpdatesRoundedIcon from "@mui/icons-material/TipsAndUpdatesRounded";
import { Box, Chip, IconButton, Stack, Tooltip, Typography, useColorScheme } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { TodoBubble } from "./components/bubbles/TodoBubble";
import { createNewTodo } from "./services/createNewTodo";
import { defaultTodoContent } from "./utils/defaults";

import { ActionButtonStyles } from "../../components/ui/styles/commonStyle";
import { useAuth } from "../../context/AuthContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { ToDoFactProps } from "../../types/chat";

type ToDoPaneProps = {
    useCM: ChatManagementState;
    myself: UserProps;
    useTEM: TeamManagementState;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useUISM: UIStateManagementState;
    todos: ToDoFactProps[];
    setTodos: React.Dispatch<React.SetStateAction<ToDoFactProps[]>>;
    isExistingTodaysTodo: boolean;
    setIsExistingTodaysTodo: (value: boolean) => void;
    currentWindowHeight: number;
};
export const ToDoPane = (props: ToDoPaneProps) => {
    const {
        useCM,
        myself,
        useTEM,
        setMyself,
        socket,
        useUISM,
        todos,
        setTodos,
        isExistingTodaysTodo,
        setIsExistingTodaysTodo,
        currentWindowHeight,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const styles = isDark ? ActionButtonStyles.dark : ActionButtonStyles.light;
    const [tmpAllTodos, setTmpAllTodos] = useState<ToDoFactProps[]>(todos);
    const [tmpIncompleteTodos, setTmpIncompleteTodos] = useState<ToDoFactProps[]>(
        todos.filter((todo) => !todo.isCompleted)
    );

    const handleCreateNewTodo = async () => {
        const todoContent = await createNewTodo(
            accessToken,
            myself,
            defaultTodoContent,
            (error) => {
                console.error(error);
            }
        );
        if (todoContent) {
            setTodos((prev) => [todoContent, ...prev]);
            setIsExistingTodaysTodo(true);
        }
    };

    useEffect(() => {
        setTmpAllTodos(todos);
        setTmpIncompleteTodos(todos.filter((todo) => !todo.isCompleted));
    }, [todos]);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);

    // Stats
    const completedCount = tmpAllTodos.filter((t) => t.isCompleted).length;
    const totalCount = tmpAllTodos.length;

    return (
        <Box
            sx={{
                // Subtract the parent chat header height (MainChatPaneHeader / SubChatPaneHeader
                // both have minHeight: 64px) so the pane fits inside its actual allocated space
                // and the Pro Tip footer below sits at the real bottom of the visible area.
                height: "calc(100dvh - 64px)",
                display: "flex",
                flexDirection: "column",
                background: isDark
                    ? "linear-gradient(180deg, rgba(30,30,35,0.4) 0%, transparent 100%)"
                    : "linear-gradient(180deg, rgba(245,247,250,0.8) 0%, transparent 100%)",
            }}
        >
            {/* Header Section */}
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
                {/* Title Row */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
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
                                sx={{
                                    fontSize: 20,
                                    color: isDark ? "#a78bfa" : "#7c3aed",
                                }}
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
                                {fmt(t.chat.todoPane.completedOfTotal, { completed: completedCount, total: totalCount })}
                            </Typography>
                        </Stack>
                    </Stack>

                    {/* Add Button */}
                    {isExistingTodaysTodo ? (
                        <Tooltip
                            title={t.chat.todoPane.existingTodayTooltip}
                            variant="outlined"
                            sx={{ borderRadius: "8px" }}
                        >
                            <IconButton
                                size="sm"
                                sx={{
                                    borderRadius: "10px",
                                    px: 1.5,
                                    py: 0.75,
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    gap: 0.5,
                                    background: "rgba(92, 92, 92, 0.12)",
                                    color: "rgba(255, 255, 255, 0.5)",
                                    // no hover action
                                    "&:hover:not(:disabled)": {
                                        background: "rgba(92, 92, 92, 0.12)",
                                        color: "rgba(255, 255, 255, 0.5)",
                                    },
                                }}
                            >
                                <AddIcon sx={{ fontSize: "18px" }} />
                                {t.chat.todoPane.newTodo}
                            </IconButton>
                        </Tooltip>
                    ) : (
                        <IconButton
                            disabled={isExistingTodaysTodo}
                            size="sm"
                            sx={{
                                background: styles.createButtonBg,
                                color: "#fff",
                                borderRadius: "10px",
                                px: 1.5,
                                py: 0.75,
                                fontSize: "13px",
                                fontWeight: 600,
                                gap: 0.5,
                                boxShadow: isDark
                                    ? "0 2px 8px rgba(124,58,237,0.4)"
                                    : "0 2px 8px rgba(124,58,237,0.3)",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    background: styles.createButtonHover,
                                    transform: "translateY(-1px)",
                                    boxShadow: isDark
                                        ? "0 4px 12px rgba(124,58,237,0.5)"
                                        : "0 4px 12px rgba(124,58,237,0.4)",
                                },
                            }}
                            onClick={handleCreateNewTodo}
                        >
                            <AddIcon sx={{ fontSize: "18px" }} />
                            {t.chat.todoPane.newTodo}
                        </IconButton>
                    )}
                </Stack>

                {/* Filter Row */}
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip
                            size="sm"
                            variant={!useCM.showOnlyInCompleteTodos ? "solid" : "soft"}
                            onClick={() => useCM.setShowOnlyInCompleteTodos(false)}
                            sx={{
                                cursor: "pointer",
                                fontWeight: 500,
                                fontSize: "0.7rem",
                                borderRadius: "6px",
                                transition: "all 0.15s ease",
                                background: !useCM.showOnlyInCompleteTodos
                                    ? isDark
                                        ? "rgba(255,255,255,0.12)"
                                        : "rgba(0,0,0,0.08)"
                                    : "transparent",
                                color: !useCM.showOnlyInCompleteTodos
                                    ? isDark
                                        ? "rgba(255,255,255,0.9)"
                                        : "white"
                                    : isDark
                                      ? "rgba(255,255,255,0.5)"
                                      : "rgba(0,0,0,0.45)",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(255,255,255,0.15)"
                                        : "rgba(0,0,0,0.1)",
                                },
                            }}
                        >
                            {fmt(t.chat.todoPane.allFilter, { count: totalCount })}
                        </Chip>
                        <Chip
                            size="sm"
                            variant={useCM.showOnlyInCompleteTodos ? "solid" : "soft"}
                            onClick={() => useCM.setShowOnlyInCompleteTodos(true)}
                            sx={{
                                cursor: "pointer",
                                fontWeight: 500,
                                fontSize: "0.7rem",
                                borderRadius: "6px",
                                transition: "all 0.15s ease",
                                background: useCM.showOnlyInCompleteTodos
                                    ? isDark
                                        ? "rgba(251,191,36,0.2)"
                                        : "rgba(251,191,36,0.15)"
                                    : "transparent",
                                color: useCM.showOnlyInCompleteTodos
                                    ? isDark
                                        ? "#fcd34d"
                                        : "rgba(255, 255, 32, 0.93)"
                                    : isDark
                                      ? "rgba(255,255,255,0.5)"
                                      : "rgba(0,0,0,0.45)",
                                "&:hover": {
                                    background: useCM.showOnlyInCompleteTodos
                                        ? isDark
                                            ? "rgba(251,191,36,0.25)"
                                            : "rgba(251,191,36,0.2)"
                                        : isDark
                                          ? "rgba(255,255,255,0.08)"
                                          : "rgba(0,0,0,0.06)",
                                },
                            }}
                            startDecorator={
                                <FilterListRoundedIcon
                                    sx={{
                                        fontSize: 14,
                                        opacity: useCM.showOnlyInCompleteTodos ? 1 : 0.6,
                                    }}
                                />
                            }
                        >
                            {fmt(t.chat.todoPane.incompleteFilter, { count: totalCount - completedCount })}
                        </Chip>
                    </Stack>
                </Stack>
            </Box>

            {/* Todo List */}
            <Box sx={{ flex: 1, px: 0.5, py: 0.5, overflow: "hidden" }}>
                {(() => {
                    // Determine which todos to display based on filter
                    const displayTodos = useCM.showOnlyInCompleteTodos
                        ? tmpIncompleteTodos
                        : tmpAllTodos;

                    if (displayTodos.length > 0) {
                        return (
                            <Virtuoso
                                ref={virtuosoRef}
                                atBottomThreshold={128}
                                atTopThreshold={64}
                                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                                initialTopMostItemIndex={0}
                                totalCount={displayTodos.length}
                                itemContent={(index) => {
                                    const todo = displayTodos[index];
                                    return (
                                        <TodoBubble
                                            key={`todo-bubble-${todo.todoId}`}
                                            useCM={useCM}
                                            currentIndex={index}
                                            isExistingTodaysTodo={isExistingTodaysTodo}
                                            myself={myself}
                                            setMyself={setMyself}
                                            setTodos={setTodos}
                                            socket={socket}
                                            useTEM={useTEM}
                                            todo={todo}
                                            useUISM={useUISM}
                                        />
                                    );
                                }}
                                style={{
                                    height: useCM.isSubChatVisible
                                        ? `${(currentWindowHeight - 250) * 0.43}px`
                                        : `${currentWindowHeight - 250}px`,
                                }}
                            />
                        );
                    }

                    // Empty State
                    return (
                        <Stack
                            alignItems="center"
                            justifyContent="center"
                            spacing={2}
                            sx={{
                                height: "100%",
                                py: 8,
                            }}
                        >
                            <Box
                                sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: "16px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: isDark
                                        ? "rgba(255,255,255,0.04)"
                                        : "rgba(0,0,0,0.03)",
                                }}
                            >
                                <CheckCircleOutlineRoundedIcon
                                    sx={{
                                        fontSize: 32,
                                        color: isDark
                                            ? "rgba(255,255,255,0.2)"
                                            : "rgba(0,0,0,0.15)",
                                    }}
                                />
                            </Box>
                            <Stack spacing={0.5} alignItems="center">
                                <Typography
                                    level="title-sm"
                                    sx={{
                                        fontWeight: 600,
                                        color: isDark
                                            ? "rgba(255,255,255,0.6)"
                                            : "rgba(0,0,0,0.55)",
                                    }}
                                >
                                    {useCM.showOnlyInCompleteTodos
                                        ? t.chat.todoPane.allCaughtUp
                                        : t.chat.todoPane.noTodosYet}
                                </Typography>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.35)"
                                            : "rgba(0,0,0,0.35)",
                                        textAlign: "center",
                                        maxWidth: 200,
                                    }}
                                >
                                    {useCM.showOnlyInCompleteTodos
                                        ? t.chat.todoPane.allCompletedSubtitle
                                        : t.chat.todoPane.createFirstSubtitle}
                                </Typography>
                            </Stack>
                        </Stack>
                    );
                })()}
            </Box>

            {/* Pro Tip at the very bottom of the ToDoPane */}
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
                            sx={{
                                fontSize: 22,
                                color: isDark ? "#a78bfa" : "#7c3aed",
                            }}
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
                            {t.chat.todoPane.proTipBody}
                        </Typography>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
};
