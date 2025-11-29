import { useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Switch, Typography } from "@mui/joy";
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
    setTodos: (value: ToDoFactProps[]) => void;
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
    const [tmpTodos, setTmpTodos] = useState<ToDoFactProps[]>(todos);

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
            setTodos([todoContent, ...todos]);
            setIsExistingTodaysTodo(true);
        }
    };

    useEffect(() => {
        if (useCM.showOnlyInCompleteTodos) {
            setTmpTodos(todos.filter((todo) => !todo.isCompleted));
        } else {
            setTmpTodos(todos);
        }
    }, [useCM.showOnlyInCompleteTodos, todos]);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);

    return (
        <Box sx={{ height: "100dvh" }}>
            <Stack
                alignItems="center"
                direction="row"
                justifyContent="center"
                sx={{ position: "relative" }}
            >
                <Button
                    color="primary"
                    disabled={isExistingTodaysTodo}
                    variant="soft"
                    sx={{
                        mt: 2,
                        mb: 1.5,
                    }}
                    onClick={handleCreateNewTodo}
                >
                    Add Today's Todo
                </Button>
                <Switch
                    checked={useCM.showOnlyInCompleteTodos}
                    color={useCM.showOnlyInCompleteTodos ? "warning" : "neutral"}
                    size="sm"
                    variant="soft"
                    slotProps={{
                        track: {
                            children: (
                                <Typography
                                    component="span"
                                    level="inherit"
                                    sx={{
                                        ml: useCM.showOnlyInCompleteTodos ? "6px" : "22px",
                                        fontWeight: "bold",
                                    }}
                                >
                                    Incomplete
                                </Typography>
                            ),
                        },
                    }}
                    sx={{
                        position: "absolute",
                        right: "30px",
                        "--Switch-thumbSize": "15px",
                        "--Switch-trackWidth": "95px",
                        "--Switch-trackHeight": "23px",
                    }}
                    onChange={() =>
                        useCM.setShowOnlyInCompleteTodos(!useCM.showOnlyInCompleteTodos)
                    }
                />
            </Stack>
            <Box sx={{ px: 0.3, my: 0.2 }}>
                {tmpTodos.length > 0 && (
                    <Virtuoso
                        ref={virtuosoRef}
                        atBottomThreshold={128}
                        atTopThreshold={64}
                        className="custom-scrollbar"
                        initialTopMostItemIndex={0}
                        totalCount={tmpTodos.length}
                        itemContent={(index) => {
                            const todo = tmpTodos[index];
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
                                    todos={tmpTodos}
                                    useUISM={useUISM}
                                />
                            );
                        }}
                        style={{
                            height: useCM.isSubChatVisible
                                ? `${(currentWindowHeight - 150) * 0.43}px`
                                : `${currentWindowHeight - 150}px`,
                        }}
                    />
                )}
            </Box>
        </Box>
    );
};
