import { Socket } from "socket.io-client";
import { useState, useEffect, useRef } from "react";
import { Box, Button } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { UserProps } from "../../types/admin";
import { useAuth } from "../../context/AuthContext";
import { loadTodo } from "./services/loadTodo";
import { ChatProps, ToDoFactProps } from "../../types/chat";
import { TodoBubble } from "./components/bubbles/TodoBubble";
import { extractYYYYMMDD } from "../../utils/dateUtils";
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
    } = props;
    const { accessToken } = useAuth();
    const [todos, setTodos] = useState<ToDoFactProps[]>([]);
    const [isExistingTodaysTodo, setIsExistingTodaysTodo] = useState(false);
    useEffect(() => {
        loadTodo(myself, accessToken).then((data) => {
            if (data) {
                setTodos(data);
                setIsExistingTodaysTodo(
                    extractYYYYMMDD(data[data.length - 1].tsCreatedAt) ===
                        extractYYYYMMDD(new Date().toISOString())
                );
            }
        });
    }, [myself, accessToken]);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);

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

    return (
        <>
            <Box
                sx={{
                    top: 0,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    my: 1,
                }}
            >
                <Button
                    variant="soft"
                    color="primary"
                    disabled={isExistingTodaysTodo}
                    onClick={handleCreateNewTodo}
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
                            height: "91vh",
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
