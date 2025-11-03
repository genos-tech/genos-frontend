import { useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import { Box, Button, Card, Chip, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { BnTodoPreview } from "../../../../components/blockNote/bnTodoPreview";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { ToDoFactProps } from "../../../../types/chat";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import { updateTodo } from "../../services/updateTodo";

type TodoBubbleProps = {
    myself: UserProps;
    todo: ToDoFactProps;
    currentIndex: number;
    isExistingTodaysTodo: boolean;
    useTEM: TeamManagementState;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    todos: ToDoFactProps[];
    setTodos: (value: ToDoFactProps[]) => void;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
};
export const TodoBubble = (props: TodoBubbleProps) => {
    const {
        myself,
        todo,
        todos,
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
    const { accessToken } = useAuth();

    const boxRef = useRef<HTMLDivElement>(null);
    const [body, setBody] = useState<PartialBlock[]>(todo.todoContent);
    const [startIntervalUpdatingTodo, setStartIntervalUpdatingTodo] = useState(false);
    const [bodyEdited, setBodyEdited] = useState(false);

    // Send updated task to the backend when task is updated
    const sendUpdatedTodo = async () => {
        const updatedTodo = await updateTodo(accessToken, myself, {
            ...todo,
            todoContent: body,
        });
        setTodos(todos.map((todo) => (todo.todoId === updatedTodo.todoId ? updatedTodo : todo)));

        // reset the bodyEdited
        setBodyEdited(false);

        // reset the startIntervalUpdatingTodo
        setStartIntervalUpdatingTodo(false);
    };

    // Auto save task body every Nms if needed
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (bodyEdited === true) {
                setStartIntervalUpdatingTodo(true);
            }
        }, 3000);

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, [bodyEdited]);

    useEffect(() => {
        if (startIntervalUpdatingTodo) {
            sendUpdatedTodo();
        }
    }, [startIntervalUpdatingTodo]);

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
                    variant="outlined"
                    sx={{
                        backgroundColor: mode === "dark" ? "black" : "white",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <Stack alignItems="center" direction="row">
                        <Chip
                            key={`todo-bubble-chip-${todo.todoId}`}
                            size="md"
                            color={
                                currentIndex === 0 && isExistingTodaysTodo === true
                                    ? "primary"
                                    : "neutral"
                            }
                            sx={{
                                marginRight: "auto",
                                borderRadius: "5px",
                                fontWeight: "bold",
                            }}
                            variant={
                                currentIndex === 0 && isExistingTodaysTodo === true
                                    ? "solid"
                                    : "soft"
                            }
                        >
                            {extractYYYYMMDD(todo.tsCreatedAt)}
                        </Chip>

                        <Chip
                            color={todo.isCompleted ? "success" : "neutral"}
                            size="md"
                            startDecorator={todo.isCompleted ? <DoneAllIcon /> : null}
                            sx={{ marginLeft: "-37px" }}
                            variant="soft"
                        >
                            {todo.isCompleted ? "Completed" : "Incomplete"}
                        </Chip>

                        <Button
                            color="primary"
                            disabled={bodyEdited === false}
                            size="sm"
                            sx={{ marginLeft: "auto", fontSize: "12px" }}
                            variant="outlined"
                            onClick={() => sendUpdatedTodo()}
                        >
                            {bodyEdited ? "Save" : "Saved"}
                        </Button>
                    </Stack>

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
