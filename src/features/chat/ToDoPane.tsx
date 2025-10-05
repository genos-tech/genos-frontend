import { Socket } from "socket.io-client";
import { useRef } from "react";
import { Box, Button, useColorScheme } from "@mui/joy";
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

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);

    return (
        <>
            <Box
                sx={{
                    top: 0,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                }}
            >
                <Button
                    variant="soft"
                    color="primary"
                    disabled={isExistingTodaysTodo}
                    onClick={handleCreateNewTodo}
                    sx={{
                        mt: 2, mb: 1,
                    }}
                >
                    Add Today's Todo
                </Button>
            </Box>
            <Box sx={{ px: 0.3, my: 0.2 }}>
                {todos.length > 0 && (
                    <Virtuoso
                        ref={virtuosoRef}
                        className="custom-scrollbar"
                        style={{
                            height: isSubChatVisible ? "41vh" : "91vh",
                        }}
                        totalCount={todos.length}
                        initialTopMostItemIndex={0}
                        atTopThreshold={64}
                        atBottomThreshold={128}
                        itemContent={(index) => {
                            const todo = todos[index];
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
                                    todos={todos}
                                    setTodos={setTodos}
                                    setOpeningService={setOpeningService}
                                    setCurrentChat={setCurrentChat}
                                />
                            );
                        }}
                    />
                )}
            </Box>
        </>
    );
};
