import { Socket } from "socket.io-client";
import { useRef, useState, useEffect } from "react";
import { Box, Button, Stack, Switch, Typography } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { UserProps } from "../../types/admin";
import { useAuth } from "../../context/AuthContext";
import { ChatProps, ToDoFactProps } from "../../types/chat";
import { TodoBubble } from "./components/bubbles/TodoBubble";
import { createNewTodo } from "./services/createNewTodo";

const defaultTodoContent = [
    {
        type: "checkListItem",
        props: {
            checked: false,
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [{ text: "Today's Todo", type: "text", styles: {} }],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [],
        children: [],
    },
];

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
    } = props;
    const { accessToken } = useAuth();
    const [tmpTodos, setTmpTodos] = useState<ToDoFactProps[]>(todos);
    const [showOnlyInCompleteTodos, setShowOnlyInCompleteTodos] = useState(false);

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
                direction="row"
                alignItems="center"
                justifyContent="center"
                sx={{ position: "relative" }}
            >
                <Button
                    variant="soft"
                    color="primary"
                    disabled={isExistingTodaysTodo}
                    onClick={handleCreateNewTodo}
                    sx={{
                        mt: 2,
                        mb: 1.5,
                    }}
                >
                    Add Today's Todo
                </Button>
                <Switch
                    checked={showOnlyInCompleteTodos}
                    onChange={() => setShowOnlyInCompleteTodos(!showOnlyInCompleteTodos)}
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
                    size="sm"
                    variant="soft"
                    sx={{
                        position: "absolute",
                        right: "30px",
                        "--Switch-thumbSize": "15px",
                        "--Switch-trackWidth": "95px",
                        "--Switch-trackHeight": "23px",
                        paddingLeft: "10px",
                    }}
                />
            </Stack>
            <Box sx={{ px: 0.3, my: 0.2 }}>
                {tmpTodos.length > 0 && (
                    <Virtuoso
                        ref={virtuosoRef}
                        className="custom-scrollbar"
                        style={{
                            height: isSubChatVisible ? "41vh" : "91vh",
                        }}
                        totalCount={tmpTodos.length}
                        initialTopMostItemIndex={0}
                        atTopThreshold={64}
                        atBottomThreshold={128}
                        itemContent={(index) => {
                            const todo = tmpTodos[index];
                            return (
                                <TodoBubble
                                    key={`todo-bubble-${todo.todoId}`}
                                    currentIndex={index}
                                    isExistingTodaysTodo={isExistingTodaysTodo}
                                    myself={myself}
                                    todo={todo}
                                    teamMemberProfiles={teamMemberProfiles}
                                    teamMembers={teamMembers}
                                    setMyself={setMyself}
                                    socket={socket}
                                    todos={tmpTodos}
                                    setTodos={setTodos}
                                    setOpeningService={setOpeningService}
                                    setCurrentChat={setCurrentChat}
                                />
                            );
                        }}
                    />
                )}
            </Box>
        </Box>
    );
};
