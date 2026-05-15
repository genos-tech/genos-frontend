import { useEffect, useRef, useState } from "react";

import { TodoService } from "../db/services/todo.service";
import { loadTodo } from "../features/chat/services/loadTodo";
import { UserProps } from "../types/admin";
import { ToDoFactProps } from "../types/chat";
import { getLocalCurrentDate } from "../utils/dateUtils";

const todoService = new TodoService();

// Derive a local YYYY-MM-DD string from a UTC-ish timestamp ("YYYY-MM-DD HH:MM:SS" or ISO).
const getLocalDateFromTs = (ts: string): string => {
    const date = new Date(ts.replace(" ", "T"));
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const hasTodaysTodo = (todos: ToDoFactProps[]): boolean =>
    todos.some((t) => getLocalDateFromTs(t.tsCreatedAt) === getLocalCurrentDate());

export const useTodos = (
    myself: UserProps,
    accessToken: string | null,
    isToDoVisible: boolean
) => {
    const [todos, setTodos] = useState<ToDoFactProps[]>([]);
    const [isExistingTodaysTodo, setIsExistingTodaysTodo] = useState(false);
    const [incompleteTodoCount, setIncompleteTodoCount] = useState<number>(0);

    // Stable ref so the midnight/visibility handlers always see the latest todos
    // without needing to re-register listeners.
    const todosRef = useRef<ToDoFactProps[]>([]);
    todosRef.current = todos;

    // Load: IDB fast path, then authoritative API fetch.
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const cached = await todoService.getTodosByUser(myself.userId);
            if (!cancelled && cached.length > 0) {
                setTodos(cached);
                setIsExistingTodaysTodo(hasTodaysTodo(cached));
            }

            const data: ToDoFactProps[] | undefined = await loadTodo(myself, accessToken);
            if (!cancelled && data) {
                setTodos(data);
                setIsExistingTodaysTodo(hasTodaysTodo(data));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [myself, accessToken, isToDoVisible]);

    // Persist any todos state change to IDB (covers create, update, initial load).
    useEffect(() => {
        if (todos.length > 0) {
            todoService.cacheTodos(todos, myself.userId);
        }
    }, [todos, myself.userId]);

    // Derived incomplete count.
    useEffect(() => {
        setIncompleteTodoCount(todos.filter((todo) => !todo.isCompleted).length);
    }, [todos]);

    // Re-evaluate isExistingTodaysTodo at midnight (handles long-running sessions)
    // and whenever the tab regains visibility (handles laptop sleep / background tabs).
    useEffect(() => {
        const reEvaluate = () => {
            setIsExistingTodaysTodo(hasTodaysTodo(todosRef.current));
        };

        let timerId: ReturnType<typeof setTimeout>;

        const scheduleNextMidnight = () => {
            const now = new Date();
            // Midnight of the next calendar day in local time.
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            timerId = setTimeout(() => {
                reEvaluate();
                scheduleNextMidnight(); // keep scheduling for multi-day sessions
            }, tomorrow.getTime() - now.getTime());
        };

        scheduleNextMidnight();
        document.addEventListener("visibilitychange", reEvaluate);

        return () => {
            clearTimeout(timerId);
            document.removeEventListener("visibilitychange", reEvaluate);
        };
    }, []); // mount/unmount only — reads latest todos via todosRef

    return {
        todos,
        setTodos,
        isExistingTodaysTodo,
        setIsExistingTodaysTodo,
        incompleteTodoCount,
    };
};
