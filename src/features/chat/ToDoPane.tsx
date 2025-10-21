import { useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Switch, Typography } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { TodoBubble } from "./components/bubbles/TodoBubble";
import { createNewTodo } from "./services/createNewTodo";
import { defaultTodoContent } from "./utils/defaults";

import { useAuth } from "../../context/AuthContext";
import { UserProps } from "../../types/admin";
import { ChatProps, ToDoFactProps } from "../../types/chat";

type ToDoPaneProps = {
    myself: UserProps;
    teamMemberProfiles: Record<string, UserProps>;
    teamMembers: UserProps[];
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    setOpeningService: (value: number) => void;
    setCurrentChat: (chat: ChatProps) => void;
    todos: ToDoFactProps[];
    setTodos: (value: ToDoFactProps[]) => void;
    isExistingTodaysTodo: boolean;
    setIsExistingTodaysTodo: (value: boolean) => void;
    isSubChatVisible: boolean;
    currentWindowHeight: number;
    showOnlyInCompleteTodos: boolean;
    setShowOnlyInCompleteTodos: (value: boolean) => void;
};
export const ToDoPane = (props: ToDoPaneProps) => {
    const {
        myself,
        teamMemberProfiles,
        teamMembers,
        setMyself,
        socket,
        setOpeningService,
        setCurrentChat,
        todos,
        setTodos,
        isExistingTodaysTodo,
        setIsExistingTodaysTodo,
        isSubChatVisible,
        currentWindowHeight,
        showOnlyInCompleteTodos,
        setShowOnlyInCompleteTodos,
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
        if (showOnlyInCompleteTodos) {
            setTmpTodos(todos.filter((todo) => !todo.isCompleted));
        } else {
            setTmpTodos(todos);
        }
    }, [showOnlyInCompleteTodos, todos]);

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
                    checked={showOnlyInCompleteTodos}
                    color={showOnlyInCompleteTodos ? "warning" : "neutral"}
                    size="sm"
                    variant="soft"
                    slotProps={{
                        track: {
                            children: (
                                <Typography
                                    component="span"
                                    level="inherit"
                                    sx={{
                                        ml: showOnlyInCompleteTodos ? "6px" : "22px",
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
                    onChange={() => setShowOnlyInCompleteTodos(!showOnlyInCompleteTodos)}
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
                                    currentIndex={index}
                                    isExistingTodaysTodo={isExistingTodaysTodo}
                                    myself={myself}
                                    setCurrentChat={setCurrentChat}
                                    setMyself={setMyself}
                                    setOpeningService={setOpeningService}
                                    setTodos={setTodos}
                                    socket={socket}
                                    teamMemberProfiles={teamMemberProfiles}
                                    teamMembers={teamMembers}
                                    todo={todo}
                                    todos={tmpTodos}
                                />
                            );
                        }}
                        style={{
                            height: isSubChatVisible
                                ? `${(currentWindowHeight - 150) * 0.43}px`
                                : `${currentWindowHeight - 150}px`,
                        }}
                    />
                )}
            </Box>
        </Box>
    );
};
