import { useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { Box, Card, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { BnTodoPreview } from "../../../../components/editors/bnTodoPreview";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { ToDoFactProps } from "../../../../types/chat";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { updateTodo } from "../../services/updateTodo";

// Color schemes
const TODO_COLORS = {
    today: { dark: "#6366f1", light: "#4f46e5" },
    completed: { dark: "#22c55e", light: "#16a34a" },
    incomplete: { dark: "#94a3b8", light: "#64748b" },
} as const;

type TodoBubbleProps = {
    myself: UserProps;
    todo: ToDoFactProps;
    currentIndex: number;
    isExistingTodaysTodo: boolean;
    useTEM: TeamManagementState;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    setTodos: React.Dispatch<React.SetStateAction<ToDoFactProps[]>>;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
};

export const TodoBubble = (props: TodoBubbleProps) => {
    const {
        myself,
        todo,
        setTodos,
        currentIndex,
        isExistingTodaysTodo,
        useTEM,
        setMyself,
        socket,
        useUISM,
        useCM,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { accessToken } = useAuth();

    const boxRef = useRef<HTMLDivElement>(null);
    const [body, setBody] = useState<PartialBlock[]>(todo.todoContent);
    const [startIntervalUpdatingTodo, setStartIntervalUpdatingTodo] = useState(false);
    const [bodyEdited, setBodyEdited] = useState(false);

    // Determine styling based on todo state
    const isToday = currentIndex === 0 && isExistingTodaysTodo === true;
    const statusColor = todo.isCompleted
        ? TODO_COLORS.completed
        : isToday
          ? TODO_COLORS.today
          : TODO_COLORS.incomplete;
    const colors = isDark ? statusColor.dark : statusColor.light;

    const sendUpdatedTodo = async () => {
        const updatedTodo = await updateTodo(accessToken, myself, {
            ...todo,
            todoContent: body,
        });
        if (updatedTodo) {
            setTodos((prev) =>
                prev.map((t) => (t.todoId === updatedTodo.todoId ? updatedTodo : t))
            );
        }
        setBodyEdited(false);
        setStartIntervalUpdatingTodo(false);
    };

    // Auto save task body every 3s if needed
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (bodyEdited === true) {
                setStartIntervalUpdatingTodo(true);
            }
        }, 3000);
        return () => clearInterval(intervalId);
    }, [bodyEdited]);

    useEffect(() => {
        if (startIntervalUpdatingTodo) {
            sendUpdatedTodo();
        }
    }, [startIntervalUpdatingTodo]);

    // Modern chip component
    const StatusChip = ({
        children,
        variant = "default",
    }: {
        children: React.ReactNode;
        variant?: "default" | "today" | "completed";
    }) => {
        const chipColors =
            variant === "completed"
                ? TODO_COLORS.completed
                : variant === "today"
                  ? TODO_COLORS.today
                  : TODO_COLORS.incomplete;
        const chipColor = isDark ? chipColors.dark : chipColors.light;

        return (
            <Box
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    height: 26,
                    px: 1,
                    ml: 0.5,
                    borderRadius: "8px",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    background:
                        variant === "today" || variant === "completed"
                            ? isDark
                                ? `linear-gradient(135deg, ${chipColor}25 0%, ${chipColor}15 100%)`
                                : `linear-gradient(135deg, ${chipColor}20 0%, ${chipColor}10 100%)`
                            : isDark
                              ? "rgba(255,255,255,0.06)"
                              : "rgba(0,0,0,0.04)",
                    color: variant === "today" || variant === "completed" ? chipColor : chipColor,
                    border: "1px solid",
                    borderColor:
                        variant === "today" || variant === "completed"
                            ? `${chipColor}40`
                            : isDark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.08)",
                    transition: "all 0.15s ease",
                }}
            >
                {children}
            </Box>
        );
    };

    return (
        <Box
            ref={boxRef}
            sx={{
                py: 0.5,
                px: "7%",
                height: "100%",
            }}
        >
            <Box key={`todo-bubble-box-${todo.todoId}`}>
                <Card
                    sx={{
                        borderRadius: "16px",
                        position: "relative",
                        overflow: "hidden",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        background: isDark
                            ? `linear-gradient(135deg, rgba(30,30,35,1) 0%, rgba(25,25,30,1) 100%)`
                            : `linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(250,250,252,1) 100%)`,
                        border: "1px solid",
                        borderColor: isToday
                            ? isDark
                                ? `${TODO_COLORS.today.dark}30`
                                : `${TODO_COLORS.today.light}20`
                            : isDark
                              ? "rgba(255,255,255,0.06)"
                              : "rgba(0,0,0,0.06)",
                        boxShadow: isToday
                            ? isDark
                                ? `0 4px 20px ${TODO_COLORS.today.dark}15, inset 0 1px 0 rgba(255,255,255,0.03)`
                                : `0 4px 20px ${TODO_COLORS.today.light}12`
                            : isDark
                              ? "0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.02)"
                              : "0 2px 8px rgba(0,0,0,0.04)",
                        "&:hover": {
                            borderColor: isToday
                                ? isDark
                                    ? `${TODO_COLORS.today.dark}45`
                                    : `${TODO_COLORS.today.light}30`
                                : isDark
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(0,0,0,0.1)",
                            boxShadow: isDark
                                ? "0 6px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)"
                                : "0 6px 24px rgba(0,0,0,0.08)",
                        },
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Subtle accent gradient for today's todo */}
                    {isToday && (
                        <Box
                            sx={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: 3,
                                background: isDark
                                    ? `linear-gradient(90deg, ${TODO_COLORS.today.dark} 0%, ${TODO_COLORS.today.dark}60 100%)`
                                    : `linear-gradient(90deg, ${TODO_COLORS.today.light} 0%, ${TODO_COLORS.today.light}60 100%)`,
                            }}
                        />
                    )}

                    {/* Header */}
                    <Stack alignItems="center" direction="row" sx={{ mb: 1 }}>
                        <StatusChip variant={isToday ? "today" : "default"}>
                            {extractYYYYMMDD(todo.tsCreatedAt)}
                        </StatusChip>

                        <StatusChip variant={todo.isCompleted ? "completed" : "default"}>
                            {todo.isCompleted ? (
                                <>
                                    <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />
                                    Completed
                                </>
                            ) : (
                                <>
                                    <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 14 }} />
                                    Incomplete
                                </>
                            )}
                        </StatusChip>

                        {/* Save button */}
                        <Box
                            component="button"
                            onClick={() => sendUpdatedTodo()}
                            disabled={bodyEdited === false}
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                height: 26,
                                px: 1,
                                ml: "auto",
                                borderRadius: "8px",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                border: "1px solid",
                                cursor: bodyEdited ? "pointer" : "default",
                                transition: "all 0.15s ease",
                                background: bodyEdited
                                    ? isDark
                                        ? `linear-gradient(135deg, ${TODO_COLORS.today.dark}20 0%, ${TODO_COLORS.today.dark}12 100%)`
                                        : `linear-gradient(135deg, ${TODO_COLORS.today.light}15 0%, ${TODO_COLORS.today.light}08 100%)`
                                    : isDark
                                      ? "rgba(255,255,255,0.04)"
                                      : "rgba(0,0,0,0.02)",
                                color: bodyEdited
                                    ? isDark
                                        ? TODO_COLORS.today.dark
                                        : TODO_COLORS.today.light
                                    : isDark
                                      ? "rgba(255,255,255,0.4)"
                                      : "rgba(0,0,0,0.35)",
                                borderColor: bodyEdited
                                    ? isDark
                                        ? `${TODO_COLORS.today.dark}40`
                                        : `${TODO_COLORS.today.light}30`
                                    : isDark
                                      ? "rgba(255,255,255,0.08)"
                                      : "rgba(0,0,0,0.06)",
                                "&:hover": bodyEdited
                                    ? {
                                          background: isDark
                                              ? `linear-gradient(135deg, ${TODO_COLORS.today.dark}30 0%, ${TODO_COLORS.today.dark}20 100%)`
                                              : `linear-gradient(135deg, ${TODO_COLORS.today.light}22 0%, ${TODO_COLORS.today.light}15 100%)`,
                                          borderColor: isDark
                                              ? `${TODO_COLORS.today.dark}55`
                                              : `${TODO_COLORS.today.light}40`,
                                          transform: "translateY(-1px)",
                                      }
                                    : {},
                                "&:active": bodyEdited
                                    ? {
                                          transform: "translateY(0)",
                                      }
                                    : {},
                            }}
                        >
                            <DoneAllIcon sx={{ fontSize: 14 }} />
                            {bodyEdited ? "Save" : "Saved"}
                        </Box>
                    </Stack>

                    {/* Todo content */}
                    <BnTodoPreview
                        key={`${todo.todoId}`}
                        body={body}
                        useCM={useCM}
                        customClassName="todo-preview"
                        myself={myself}
                        setBody={setBody}
                        setBodyEdited={setBodyEdited}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                </Card>
            </Box>
        </Box>
    );
};
