import { useEffect, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Button, Chip, Stack, Tooltip, Typography, useColorScheme } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { TodoBubble } from "./components/bubbles/TodoBubble";
import { createNewTodo } from "./services/createNewTodo";
import { defaultTodoContent } from "./utils/defaults";

import { useAuth } from "../../context/AuthContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
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
    const isDark = mode === "dark";
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
        console.log(3, todos);
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
                height: "100dvh",
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
                                    ? "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.2) 100%)"
                                    : "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)",
                            }}
                        >
                            <TaskAltRoundedIcon
                                sx={{
                                    fontSize: 20,
                                    color: isDark ? "#a5b4fc" : "#6366f1",
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
                                My Todos
                            </Typography>
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                                    fontSize: "0.75rem",
                                }}
                            >
                                {completedCount} of {totalCount} completed
                            </Typography>
                        </Stack>
                    </Stack>

                    {/* Add Button */}
                    <Tooltip
                        title={
                            isExistingTodaysTodo
                                ? "Today's todo already exists"
                                : "Add today's todo"
                        }
                        variant="outlined"
                    >
                        <span>
                            <Button
                                disabled={isExistingTodaysTodo}
                                size="sm"
                                variant="solid"
                                onClick={handleCreateNewTodo}
                                sx={{
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                    fontSize: "0.8rem",
                                    px: 1.5,
                                    py: 0.75,
                                    background: isDark
                                        ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                                        : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                                    boxShadow: isDark
                                        ? "0 2px 8px rgba(99,102,241,0.3)"
                                        : "0 2px 8px rgba(99,102,241,0.25)",
                                    transition: "all 0.2s ease",
                                    "&:hover:not(:disabled)": {
                                        transform: "translateY(-1px)",
                                        boxShadow: isDark
                                            ? "0 4px 12px rgba(99,102,241,0.4)"
                                            : "0 4px 12px rgba(99,102,241,0.35)",
                                    },
                                    "&:disabled": {
                                        background: isDark
                                            ? "rgba(255,255,255,0.08)"
                                            : "rgba(0,0,0,0.06)",
                                        color: isDark
                                            ? "rgba(255,255,255,0.3)"
                                            : "rgba(0,0,0,0.3)",
                                        boxShadow: "none",
                                    },
                                }}
                                startDecorator={<AddRoundedIcon sx={{ fontSize: 18 }} />}
                            >
                                New Todo
                            </Button>
                        </span>
                    </Tooltip>
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
                            All ({totalCount})
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
                            Incomplete ({totalCount - completedCount})
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
                                        ? `${(currentWindowHeight - 180) * 0.43}px`
                                        : `${currentWindowHeight - 180}px`,
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
                                        ? "All caught up!"
                                        : "No todos yet"}
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
                                        ? "You've completed all your tasks"
                                        : "Create your first todo to get started"}
                                </Typography>
                            </Stack>
                        </Stack>
                    );
                })()}
            </Box>
        </Box>
    );
};
