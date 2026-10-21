/**
 * `useCollaborativeBlockNote` exposes the scope the collab server granted
 * (`provider.authorizedScope`) as `collabScope` — the note editors gate
 * typing on it (MIP-731). The provider is faked: what's under test is that
 * the hook reads the scope on every authentication and doesn't carry one
 * document's scope over to the next.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCollaborativeBlockNote } from "../hooks/common/useCollaborativeBlockNote";

const providers = vi.hoisted(() => {
    // Read at module load by the hook; without it no provider is created.
    vi.stubEnv("VITE_COLLAB_URL", "ws://collab.test");
    return [] as FakeProvider[];
});

type FakeProvider = {
    configuration: { onAuthenticated: () => void };
    authorizedScope: string | undefined;
    authenticate: (scope: string) => void;
};

vi.mock("@hocuspocus/provider", () => ({
    HocuspocusProvider: class {
        configuration: { onAuthenticated: () => void };
        authorizedScope: string | undefined = undefined;
        constructor(configuration: { onAuthenticated: () => void }) {
            this.configuration = configuration;
            providers.push(this as unknown as FakeProvider);
        }
        // What the real provider does on the server's Authenticated message.
        authenticate(scope: string) {
            this.authorizedScope = scope;
            this.configuration.onAuthenticated();
        }
        destroy() {}
    },
}));
vi.mock("@blocknote/react", () => ({ useCreateBlockNote: () => ({ document: [] }) }));
vi.mock("../db/utils/yjsPersistence", () => ({
    createYjsPersistence: () => ({}),
    destroyYjsPersistence: () => Promise.resolve(),
}));

const options = {
    user: { name: "Viewer", color: "#000" },
    userId: "u-viewer",
    myself: { userId: "u-viewer" } as never,
    accessToken: "access-token",
    schema: {} as never,
    dictionary: {},
};

describe("useCollaborativeBlockNote collabScope", () => {
    it("reports the scope from each authentication", () => {
        const { result } = renderHook(() =>
            useCollaborativeBlockNote({ ...options, documentName: "my-note:1" })
        );
        expect(result.current.collabScope).toBeUndefined();

        const provider = providers.at(-1)!;
        act(() => provider.authenticate("readonly"));
        expect(result.current.collabScope).toBe("readonly");

        // A reconnect after the role changed re-authenticates with the new scope.
        act(() => provider.authenticate("read-write"));
        expect(result.current.collabScope).toBe("read-write");
    });

    it("drops the previous document's scope when the provider is rebuilt", () => {
        const { result, rerender } = renderHook(
            ({ documentName }) => useCollaborativeBlockNote({ ...options, documentName }),
            { initialProps: { documentName: "my-note:1" } }
        );
        const first = providers.at(-1)!;
        act(() => first.authenticate("read-write"));
        expect(result.current.collabScope).toBe("read-write");

        rerender({ documentName: "my-note:2" });
        expect(providers.at(-1)).not.toBe(first);
        expect(result.current.collabScope).toBeUndefined();
    });
});
