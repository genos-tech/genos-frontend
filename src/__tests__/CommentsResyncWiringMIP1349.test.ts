// @vitest-environment node
/**
 * MIP-1349: every comment view that shows a task's comments listens for the
 * resync, and the two producers are mounted.
 *
 * Rendering the task preview, the milestone preview and the chat thread's
 * Comments tab whole to watch one subscription is far more setup than the
 * subscription is worth; each file is read as source instead (the cache and
 * socket behaviour are exercised for real in CommentsResyncMIP1349.test.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const read = (file: string) =>
    fs
        .readFileSync(path.join(SRC, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("who listens", () => {
    it("the task preview, for both its regular and its milestone mode", () => {
        const calls = read("features/tasks/components/contents/TaskPreview.tsx").match(
            /onCommentsResync\s*\(/g
        );
        expect(calls?.length).toBe(2);
    });

    it("the chat thread's Comments tab", () => {
        expect(read("features/chat/components/shared/ThreadCommentsView.tsx")).toMatch(
            /onCommentsResync\s*\(/
        );
    });
});

describe("who asks", () => {
    it("the socket handler, on a reconnect", () => {
        const code = read("hooks/common/handlers/websocket-handlers.ts");
        expect(code).toMatch(/noteSocketConnected\s*\(\s*socket\s*\)/);
        expect(code).toMatch(/emitCommentsResync\s*\(/);
    });

    it("the app, on a return to the tab", () => {
        expect(read("hooks/common/useWebSocket.ts")).toMatch(/installCommentsWakeResync\s*\(/);
    });
});
