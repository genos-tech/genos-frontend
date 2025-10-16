import { useEffect, useState } from "react";

import { loadTodo } from "../features/chat/services/loadTodo";
import { UserProps } from "../types/admin";
import { ToDoFactProps } from "../types/chat";
import { extractYYYYMMDD } from "../utils/dateUtils";

export const useTodos = (myself: UserProps, accessToken: string) => {
    const [todos, setTodos] = useState<ToDoFactProps[]>([]);
    const [isExistingTodaysTodo, setIsExistingTodaysTodo] = useState(false);
    const [incompleteTodoCount, setIncompleteTodoCount] = useState<number>(0);

    useEffect(() => {
        loadTodo(myself, accessToken).then((data) => {
            if (data) {
                setTodos(data);
                if (data.length > 0) {
                    setIsExistingTodaysTodo(
                        extractYYYYMMDD(data[0].tsCreatedAt) ===
                            extractYYYYMMDD(new Date().toISOString())
                    );
                }
            }
        });
    }, [myself, accessToken]);

    useEffect(() => {
        setIncompleteTodoCount(todos.filter((todo) => !todo.isCompleted).length);
    }, [todos]);

    return {
        todos,
        setTodos,
        isExistingTodaysTodo,
        setIsExistingTodaysTodo,
        incompleteTodoCount,
    };
};
