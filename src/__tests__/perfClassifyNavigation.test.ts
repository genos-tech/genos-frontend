import { describe, expect, it } from "vitest";

import { classifyNavigation } from "../services/perf/classifyNavigation";

describe("classifyNavigation", () => {
    it.each([
        // service rail
        ["/workspace/tasks/project/1", "/workspace/notes/my/9", "service_switch"],
        ["/workspace/notes/my/9", "/workspace/chat/dm", "service_switch"],
        ["/workspace/chat/dm", "/workspace/tasks", "service_switch"],
        // tasks
        ["/workspace/tasks/project/1", "/workspace/tasks/project/1/task/5", "task_open"],
        ["/workspace/tasks/project/1/task/4", "/workspace/tasks/project/1/task/5", "task_switch"],
        [
            "/workspace/tasks/project/1/task/4",
            "/workspace/tasks/project/1/milestone/7",
            "task_switch",
        ],
        ["/workspace/tasks/project/1", "/workspace/tasks/project/1/milestone/7", "task_open"],
        // project
        ["/workspace/tasks/project/1", "/workspace/tasks/project/2", "project_switch"],
        // notes
        ["/workspace/notes", "/workspace/notes/my/9", "note_open"],
        ["/workspace/notes/my/9", "/workspace/notes/my/10", "note_switch"],
        ["/workspace/notes/my/9", "/workspace/notes/team/9", "note_switch"],
    ])("%s -> %s is %s", (prev, next, kind) => {
        expect(classifyNavigation(prev, next)).toBe(kind);
    });

    it.each([
        ["first route of the session", null, "/workspace/tasks/project/1"],
        ["same route", "/workspace/tasks/project/1/task/5", "/workspace/tasks/project/1/task/5"],
        ["closing the preview", "/workspace/tasks/project/1/task/5", "/workspace/tasks/project/1"],
        ["switching chats", "/workspace/chat/dm/a", "/workspace/chat/dm/b"],
        ["a route outside the workspace", "/workspace/tasks/project/1", "/signin"],
        ["closing a note", "/workspace/notes/my/9", "/workspace/notes"],
    ])("ignores %s", (_name, prev, next) => {
        expect(classifyNavigation(prev as string | null, next)).toBeNull();
    });
});
