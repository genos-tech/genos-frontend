import { useState } from "react";
import { PartialBlock } from "@blocknote/core";
import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { MessageProps, ThreadMessageProps, ToDoFactProps } from "../../../types/chat";
import { getLocalCurrentDate } from "../../../utils/dateUtils";
import { updateTodo } from "./updateTodo";

export const createNewTodo = async (
    accessToken: string | null,
    myself: UserProps,
    todoContent: any[],
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = authApi(accessToken);
        const dtLocalDate = getLocalCurrentDate();
        if (api) {
            const res = await api.post("/todo/", {
                team_id: myself.teamId,
                user_id: myself.userId,
                todo_content: todoContent,
                dt_local_date: dtLocalDate,
            });
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage("Unauthorized. Auth toke is not found.");
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage("DM already exists.");
                }
            } else if (error.response?.status === 401) {
                console.error("HTTP 401 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage("Unauthorized. Please log in again.");
                }
            } else {
                console.error("API error:", error.response?.status, error.response?.data);
            }
        } else {
            console.error("Unexpected error:", error);
        }
    }
};

const createNewTodoItem = (
    chatType: number,
    chatId: number,
    threadId: number | null,
    messageId: number,
    messageText: string,
    isThread: boolean
) => {
    const currentDomain = window.location.origin;
    let href = "";
    let fromText = "";
    if (chatType === 1) {
        href = `${currentDomain}/workspace/chat/dm/${chatId}/message/${messageId}`;
        fromText = "[Todo from DM] ";
        if (isThread && threadId) {
            href = `${currentDomain}/workspace/chat/dm/${chatId}/thread/${threadId}/message/${messageId}`;
            fromText = "[Todo from DM Thread] ";
        }
    } else if (chatType === 2) {
        href = `${currentDomain}/workspace/chat/gm/${chatId}/message/${messageId}`;
        fromText = "[Todo from GM] ";
        if (isThread && threadId) {
            href = `${currentDomain}/workspace/chat/gm/${chatId}/thread/${threadId}/message/${messageId}`;
            fromText = "[Todo from GM Thread] ";
        }
    } else if (chatType === 3 && threadId) {
        // Only comment
        href = `${currentDomain}/workspace/chat/pm/${chatId}/thread/${threadId}/comment/${messageId}`;
        fromText = "[Todo from Task Comment] ";
    } else if (chatType === 4) {
        href = `${currentDomain}/workspace/chat/mdm/${chatId}/message/${messageId}`;
        fromText = "[Todo from DM] ";
        if (isThread && threadId) {
            href = `${currentDomain}/workspace/chat/mdm/${chatId}/thread/${threadId}/message/${messageId}`;
            fromText = "[Todo from DM Thread] ";
        }
    }

    if (href === "") {
        return null;
    }

    return {
        type: "checkListItem",
        props: {
            checked: false,
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            { text: fromText, type: "text", styles: { bold: true, textColor: "blue" } },
            {
                href: href,
                type: "link",
                content: [{ text: `${messageText}`, type: "text", styles: {} }],
            },
        ],
        children: [],
    };
};

// Append todo content to an existing todo
export const appendTodoContent = async (
    accessToken: string | null,
    myself: UserProps,
    todos: ToDoFactProps[],
    setTodos: (todos: ToDoFactProps[]) => void,
    todayTodo: ToDoFactProps,
    chatType: number,
    chatId: number,
    threadId: number | null,
    messageId: number,
    isThread: boolean,
    messageText: string
) => {
    const newTodoContent = createNewTodoItem(
        chatType,
        chatId,
        threadId,
        messageId,
        messageText,
        isThread
    );
    if (newTodoContent) {
        const updatedTodo = await updateTodo(accessToken, myself, {
            ...todayTodo,
            todoContent: [
                ...todayTodo.todoContent.slice(0, -1),
                newTodoContent,
                ...todayTodo.todoContent.slice(-1),
            ],
        });
        if (updatedTodo) {
            // Replace new todo at the first position
            setTodos([updatedTodo, ...todos.filter((todo) => todo.todoId !== updatedTodo.todoId)]);
        }
    }
};
