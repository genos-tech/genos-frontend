/**
 * MIP-921. While the api swaps deployments, the collab server cannot ask it
 * whether a user may open a document, and refuses with the reason
 * `access-check-unavailable`. The provider takes any refusal as final, so the
 * editor used to sit disconnected, showing its offline copy, until the person
 * reopened the document. `useCollaborativeBlockNote` now reconnects, with a
 * back-off, and holds back the offline copy meanwhile.
 *
 * The provider is faked, and driven the way the real one behaves: a refusal
 * is `onAuthenticationFailed({ reason })`, and closing the refused socket
 * ends in `onDisconnect`. What a REAL provider does with the same calls is
 * `useCollaborativeBlockNoteReconnectReal.test.ts`.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { ACCESS_CHECK_UNAVAILABLE, RECONNECT_DELAYS_MS } from "../hooks/common/collabReconnect";
import { useCollaborativeBlockNote } from "../hooks/common/useCollaborativeBlockNote";

type Configuration = {
    document: Y.Doc;
    websocketProvider: { disconnect: ReturnType<typeof vi.fn> };
    onAuthenticated: () => void;
    onAuthenticationFailed: (data: { reason: string }) => void;
    onDisconnect: (data: { event: { code: number } }) => void;
    onSynced: (data: { state: boolean }) => void;
};
type FakeProvider = {
    configuration: Configuration;
    authorizedScope: string | undefined;
    connect: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
};

const fakes = vi.hoisted(() => {
    // Read at module load by the hook; without it no provider is created.
    vi.stubEnv("VITE_COLLAB_URL", "ws://collab.test");
    return {
        providers: [] as FakeProvider[],
        // What the editor shows. `replaceBlocks` is how the hook seeds its
        // offline copy into the Yjs doc.
        editor: { document: [] as unknown[], replaceBlocks: vi.fn() },
    };
});
const { providers, editor } = fakes;

vi.mock("@hocuspocus/provider", () => ({
    HocuspocusProvider: class {
        configuration: Configuration;
        authorizedScope: string | undefined = undefined;
        connect = vi.fn(() => Promise.resolve());
        destroy = vi.fn();
        constructor(configuration: Omit<Configuration, "websocketProvider">) {
            // Closing a socket ends in the provider's `disconnect` event.
            const disconnect = vi.fn(() =>
                queueMicrotask(() => this.configuration.onDisconnect({ event: { code: 1005 } }))
            );
            this.configuration = { ...configuration, websocketProvider: { disconnect } };
            providers.push(this as unknown as FakeProvider);
        }
    },
}));
vi.mock("@blocknote/react", () => ({ useCreateBlockNote: () => editor }));
vi.mock("../db/utils/yjsPersistence", () => ({
    createYjsPersistence: () => ({}),
    destroyYjsPersistence: () => Promise.resolve(),
}));

const REST_COPY = [{ type: "paragraph", content: "the copy the REST api sent" }];

const options = {
    user: { name: "Editor", color: "#000" },
    userId: "u-editor",
    myself: { userId: "u-editor" } as never,
    accessToken: "access-token",
    schema: {} as never,
    dictionary: {},
    initialBody: REST_COPY,
};

const mount = (props: Partial<Parameters<typeof useCollaborativeBlockNote>[0]> = {}) =>
    renderHook(
        (extra: Partial<Parameters<typeof useCollaborativeBlockNote>[0]>) =>
            useCollaborativeBlockNote({ ...options, documentName: "task-body:1", ...extra }),
        { initialProps: props }
    );

/** What the provider does when the server says no. */
const refuse = (provider: FakeProvider, reason: string) =>
    act(() => provider.configuration.onAuthenticationFailed({ reason }));

/** Runs the timers, and the microtasks (the fake socket's close event) they leave. */
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

/** The retry got through: authenticated, then the server's document arrives. */
const reconnectSucceeds = (provider: FakeProvider, scope = "read-write") =>
    act(() => {
        provider.authorizedScope = scope;
        provider.configuration.onAuthenticated();
        // The server's copy of the body, written by whoever opened the
        // document first, under another client id. The editor mirrors the
        // fragment, which `seedDocument` reads it through.
        const fragment = provider.configuration.document.getXmlFragment("document-store");
        const text = new Y.XmlText();
        text.insert(0, "the body from the server");
        fragment.insert(0, [text]);
        editor.document = [
            { type: "paragraph", content: [{ type: "text", text: "the body from the server" }] },
        ];
        provider.configuration.onSynced({ state: true });
    });

beforeEach(() => {
    providers.length = 0;
    editor.document = [];
    editor.replaceBlocks.mockClear();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("reconnecting after the collab server could not check access", () => {
    it("closes the refused socket at once and reconnects after 1, 2, 4, 8 and 16 seconds", async () => {
        mount();
        const provider = providers.at(-1)!;
        const socket = provider.configuration.websocketProvider;
        expect(RECONNECT_DELAYS_MS).toEqual([1000, 2000, 4000, 8000, 16000]);

        for (const [i, delay] of RECONNECT_DELAYS_MS.entries()) {
            refuse(provider, ACCESS_CHECK_UNAVAILABLE);
            // Dropped now, not left open for the server's idle timeout to
            // close it with a 4401 that the provider never retries.
            expect(socket.disconnect).toHaveBeenCalledTimes(i + 1);
            await wait(delay - 1);
            expect(provider.connect, `before attempt ${i + 1}`).toHaveBeenCalledTimes(i);
            await wait(1);
            expect(provider.connect, `attempt ${i + 1}`).toHaveBeenCalledTimes(i + 1);
        }
    });

    it("stops after the last attempt and settles for the offline copy, as it always did", async () => {
        const { result } = mount();
        const provider = providers.at(-1)!;

        for (const delay of RECONNECT_DELAYS_MS) {
            refuse(provider, ACCESS_CHECK_UNAVAILABLE);
            await wait(delay);
        }
        expect(provider.connect).toHaveBeenCalledTimes(RECONNECT_DELAYS_MS.length);
        expect(editor.replaceBlocks).not.toHaveBeenCalled();

        // The sixth refusal is final.
        refuse(provider, ACCESS_CHECK_UNAVAILABLE);
        await wait(0);
        expect(result.current.connectionStatus).toBe("disconnected");
        expect(editor.replaceBlocks).toHaveBeenCalledTimes(1);
        expect(editor.replaceBlocks).toHaveBeenCalledWith(editor.document, REST_COPY);

        await wait(120_000);
        expect(provider.connect).toHaveBeenCalledTimes(RECONNECT_DELAYS_MS.length);
        expect(result.current.connectionStatus).toBe("disconnected");
    });

    it("does nothing special for any other reason", async () => {
        const { result } = mount();
        const provider = providers.at(-1)!;

        refuse(provider, "permission-denied");
        await wait(0);
        expect(result.current.connectionStatus).toBe("disconnected");
        // The offline copy, immediately: this is also what shows the spy
        // below can see a seed when there is one.
        expect(editor.replaceBlocks).toHaveBeenCalledTimes(1);

        await wait(120_000);
        expect(provider.connect).not.toHaveBeenCalled();
        expect(provider.configuration.websocketProvider.disconnect).not.toHaveBeenCalled();
    });

    it("never seeds the offline copy while it is retrying, so the server's body can't arrive beside it", async () => {
        const { result } = mount();
        const provider = providers.at(-1)!;

        refuse(provider, ACCESS_CHECK_UNAVAILABLE);
        // The socket we closed reports its close, which seeds when not synced.
        await wait(0);
        await wait(1000);
        expect(provider.connect).toHaveBeenCalledTimes(1);
        expect(result.current.connectionStatus).toBe("disconnected");
        expect(editor.replaceBlocks).not.toHaveBeenCalled();

        // The retry gets through and the server's document syncs in.
        reconnectSucceeds(provider);
        await wait(1000);
        expect(result.current.connectionStatus).toBe("connected");
        expect(result.current.collabScope).toBe("read-write");
        expect(editor.replaceBlocks, "the REST copy was never written").not.toHaveBeenCalled();
        expect(provider.configuration.document.getXmlFragment("document-store").length).toBe(1);
    });

    it("still seeds the REST copy when the retry reaches a document that is empty on the server", async () => {
        // The first open of a document: nobody has seeded the server yet, so
        // this is exactly the seed an ordinary open does. It must not be
        // swallowed by the hold-back that the retries needed.
        mount();
        const provider = providers.at(-1)!;

        refuse(provider, ACCESS_CHECK_UNAVAILABLE);
        await wait(1000);
        expect(editor.replaceBlocks).not.toHaveBeenCalled();

        act(() => {
            provider.configuration.onAuthenticated();
            provider.configuration.onSynced({ state: true });
        });
        await wait(0);
        expect(editor.replaceBlocks).toHaveBeenCalledTimes(1);
        expect(editor.replaceBlocks).toHaveBeenCalledWith(editor.document, REST_COPY);
    });

    it("once the retry is authenticated the refusal is over: a drop before the sync is an ordinary one", async () => {
        mount();
        const provider = providers.at(-1)!;

        refuse(provider, ACCESS_CHECK_UNAVAILABLE);
        await wait(1000);
        act(() => provider.configuration.onAuthenticated());
        // The socket goes before the document syncs: as on any open, the
        // offline copy is what there is to show.
        act(() => provider.configuration.onDisconnect({ event: { code: 1006 } }));
        await wait(0);
        expect(editor.replaceBlocks).toHaveBeenCalledTimes(1);
    });

    it("a sync ends the retries even if no authentication event came first", async () => {
        mount();
        const provider = providers.at(-1)!;

        refuse(provider, ACCESS_CHECK_UNAVAILABLE);
        await wait(1000);
        act(() => provider.configuration.onSynced({ state: true }));
        await wait(0);
        expect(editor.replaceBlocks).toHaveBeenCalledTimes(1);
    });

    it("doesn't seed a REST copy that arrives while it is retrying either", async () => {
        const { result, rerender } = mount({ initialBody: undefined });
        const provider = providers.at(-1)!;

        refuse(provider, ACCESS_CHECK_UNAVAILABLE);
        await wait(0);
        rerender({ initialBody: REST_COPY });
        await wait(500);
        expect(editor.replaceBlocks).not.toHaveBeenCalled();

        // ... but it is still the fallback once the retries are used up.
        for (const delay of RECONNECT_DELAYS_MS) {
            await wait(delay);
            refuse(provider, ACCESS_CHECK_UNAVAILABLE);
        }
        await wait(0);
        expect(result.current.connectionStatus).toBe("disconnected");
        expect(editor.replaceBlocks).toHaveBeenCalledTimes(1);
    });

    it("a refusal for another reason during the retries ends them, with the offline copy", async () => {
        const { result } = mount();
        const provider = providers.at(-1)!;

        refuse(provider, ACCESS_CHECK_UNAVAILABLE);
        await wait(1000);
        expect(provider.connect).toHaveBeenCalledTimes(1);

        // Access was revoked in the meantime.
        refuse(provider, "permission-denied");
        await wait(0);
        expect(result.current.connectionStatus).toBe("disconnected");
        expect(editor.replaceBlocks).toHaveBeenCalledTimes(1);

        await wait(120_000);
        expect(provider.connect).toHaveBeenCalledTimes(1);
    });

    it("a connection that gets through ends the retries, and the next incident starts afresh", async () => {
        const { result } = mount();
        const provider = providers.at(-1)!;

        refuse(provider, ACCESS_CHECK_UNAVAILABLE);
        await wait(1000);
        refuse(provider, ACCESS_CHECK_UNAVAILABLE);
        await wait(2000);
        expect(provider.connect).toHaveBeenCalledTimes(2);

        reconnectSucceeds(provider);
        await wait(120_000);
        expect(provider.connect).toHaveBeenCalledTimes(2);
        expect(result.current.connectionStatus).toBe("connected");

        // The socket drops later and the re-authentication is refused again:
        // back to a 1 s wait, not the 4 s the last incident had reached.
        refuse(provider, ACCESS_CHECK_UNAVAILABLE);
        await wait(999);
        expect(provider.connect).toHaveBeenCalledTimes(2);
        await wait(1);
        expect(provider.connect).toHaveBeenCalledTimes(3);
    });

    it("unmounting cancels a pending reconnect", async () => {
        const { unmount } = mount();
        const provider = providers.at(-1)!;

        refuse(provider, ACCESS_CHECK_UNAVAILABLE);
        await wait(500);
        unmount();
        expect(provider.destroy).toHaveBeenCalledTimes(1);

        await wait(120_000);
        expect(provider.connect).not.toHaveBeenCalled();
    });

    it("another document cancels the old one's reconnect and starts with a clean slate", async () => {
        const { rerender, result } = mount();
        const first = providers.at(-1)!;

        refuse(first, ACCESS_CHECK_UNAVAILABLE);
        await wait(500);
        rerender({ documentName: "task-body:2" });
        const second = providers.at(-1)!;
        expect(second).not.toBe(first);

        await wait(120_000);
        expect(first.connect).not.toHaveBeenCalled();
        expect(second.connect).not.toHaveBeenCalled();

        // The first document's pending retry must not hold back the second's
        // offline copy.
        refuse(second, "permission-denied");
        await wait(0);
        expect(result.current.connectionStatus).toBe("disconnected");
        expect(editor.replaceBlocks).toHaveBeenCalledTimes(1);
    });
});
