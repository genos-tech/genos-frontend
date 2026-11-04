/**
 * MIP-921, against the REAL `@hocuspocus/provider`. The other test file fakes
 * the provider, so it can only show that the hook calls what it was written
 * to call. Here the provider is the one the app ships, behind a scripted
 * WebSocket that answers its authentication the way genos-collab does: a
 * `PermissionDenied` frame carrying a reason, or `Authenticated`. What is
 * checked is the part a fake cannot: that the reason arrives at the hook, that
 * the refused socket really is closed, and that the reconnect really opens a
 * second socket and authenticates on it.
 *
 * The server side of the same story (the reason travelling in the frame; a
 * second authentication on a refused socket going unanswered) is pinned in
 * genos-collab's `access.test.js`, against a real Hocuspocus server.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCollaborativeBlockNote } from "../hooks/common/useCollaborativeBlockNote";

const editor = vi.hoisted(() => {
    // Read at module load by the hook; without it no provider is created.
    vi.stubEnv("VITE_COLLAB_URL", "ws://collab.test");
    return { document: [] as unknown[], replaceBlocks: vi.fn() };
});
vi.mock("@blocknote/react", async (importOriginal) => ({
    // The editors' own specs (math, diagram) are built from the real module.
    ...(await importOriginal<Record<string, unknown>>()),
    useCreateBlockNote: () => editor,
}));
vi.mock("../db/utils/yjsPersistence", () => ({
    createYjsPersistence: () => ({}),
    destroyYjsPersistence: () => Promise.resolve(),
}));

// Hocuspocus' wire format, for the few frames that matter. Everything here
// is shorter than 128 bytes, so every length and number is one byte.
const MESSAGE_AUTH = 2;
const AUTH_PERMISSION_DENIED = 1;
const AUTH_AUTHENTICATED = 2;
const str = (s: string) => {
    const bytes = new TextEncoder().encode(s);
    return [bytes.length, ...bytes];
};
const serverFrame = (documentName: string, authType: number, payload: string) =>
    Uint8Array.from([...str(documentName), MESSAGE_AUTH, authType, ...str(payload)]);
/** Is this client frame an Authentication message? (document name, type 2) */
const isAuthentication = (frame: Uint8Array) => frame[1 + frame[0]] === MESSAGE_AUTH;

/** What the scripted server answers each authentication with, in order. */
let answers: Array<string>;
let authentications: number;

class FakeSocket {
    static instances: FakeSocket[] = [];
    binaryType = "";
    identifier = 0;
    readyState = 0;
    closed = false;
    private listeners: Record<string, Array<(event: unknown) => void>> = {};

    constructor(readonly url: string) {
        FakeSocket.instances.push(this);
        queueMicrotask(() => {
            this.readyState = 1;
            this.emit("open", {});
        });
    }

    addEventListener(name: string, listener: (event: unknown) => void) {
        (this.listeners[name] ??= []).push(listener);
    }
    removeEventListener(name: string, listener: (event: unknown) => void) {
        this.listeners[name] = (this.listeners[name] ?? []).filter((l) => l !== listener);
    }
    private emit(name: string, event: unknown) {
        for (const listener of this.listeners[name] ?? []) listener(event);
    }

    send(data: Uint8Array) {
        if (!isAuthentication(data)) return;
        const answer = answers[authentications++];
        const frame =
            answer === "ok"
                ? serverFrame("task-body:1", AUTH_AUTHENTICATED, "read-write")
                : serverFrame("task-body:1", AUTH_PERMISSION_DENIED, answer);
        queueMicrotask(() => this.emit("message", { data: frame.buffer }));
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        this.readyState = 3;
        queueMicrotask(() => this.emit("close", { code: 1005, reason: "" }));
    }
}

const REST_COPY = [{ type: "paragraph", content: "the copy the REST api sent" }];

const mount = () =>
    renderHook(() =>
        useCollaborativeBlockNote({
            documentName: "task-body:1",
            user: { name: "Editor", color: "#000" },
            userId: "u-editor",
            myself: { userId: "u-editor" } as never,
            accessToken: "access-token",
            schema: {} as never,
            dictionary: {},
            initialBody: REST_COPY,
        })
    );

beforeEach(() => {
    FakeSocket.instances = [];
    authentications = 0;
    editor.document = [];
    editor.replaceBlocks.mockClear();
    vi.stubGlobal("WebSocket", FakeSocket);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("useCollaborativeBlockNote with the real provider", () => {
    it("closes the refused socket, opens a new one after a second, and authenticates on it", async () => {
        // The literal genos-collab sends, not this app's constant for it.
        answers = ["access-check-unavailable", "ok"];
        const { result, unmount } = mount();

        // The refusal reached the hook, which closed the socket it came on.
        await vi.waitFor(() => expect(FakeSocket.instances[0]?.closed).toBe(true));
        expect(FakeSocket.instances).toHaveLength(1);
        // ... and holds the offline copy back while it waits.
        expect(editor.replaceBlocks).not.toHaveBeenCalled();
        expect(result.current.collabScope).toBeUndefined();

        // The backoff is a second; the reconnect is a new socket, not the old one.
        await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(2), { timeout: 3000 });
        await vi.waitFor(() => expect(result.current.collabScope).toBe("read-write"));
        expect(FakeSocket.instances[1].closed).toBe(false);
        expect(authentications).toBe(2);
        expect(editor.replaceBlocks).not.toHaveBeenCalled();
        unmount();
    });

    it("any other refusal is final: the offline copy at once, and no second socket", async () => {
        answers = ["permission-denied"];
        const { result, unmount } = mount();

        await vi.waitFor(() => expect(editor.replaceBlocks).toHaveBeenCalledTimes(1));
        expect(result.current.connectionStatus).toBe("disconnected");

        // Longer than the first backoff would have taken.
        await new Promise((resolve) => setTimeout(resolve, 1500));
        expect(FakeSocket.instances).toHaveLength(1);
        expect(authentications).toBe(1);
        unmount();
    });
});
