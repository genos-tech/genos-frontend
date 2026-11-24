import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../context/AuthContext";
import { useAuth } from "../context/authState";

const refreshSession = vi.fn();
vi.mock("../services/refreshSession", () => ({
    refreshSession: (...args: unknown[]) => refreshSession(...args),
}));
vi.mock("../db/services/note.service", () => ({
    NoteService: class {
        getAllPersonalNotes = async () => [];
        getAllChatNotes = async () => [];
        getAllTaskNotes = async () => [];
    },
}));
vi.mock("../db/services/task.service", () => ({
    TaskService: class {
        getAllTasks = async () => [];
    },
}));
vi.mock("../db/utils/database", () => ({ DatabaseUtils: { sweepOrphanYjsDatabases: vi.fn() } }));
vi.mock("../services/analytics", () => ({ analytics: { reset: vi.fn() } }));
vi.mock("../services/privateProfileStore", () => ({
    clearPrivateProfile: vi.fn(),
    ensurePrivateProfile: vi.fn().mockResolvedValue({}),
    purgeStoredPrivateProfile: vi.fn(),
}));
vi.mock("../utils/editorDraftStorage", () => ({ clearAllEditorDrafts: vi.fn() }));

const b64url = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const tokenExpiringIn = (seconds: number, nonce: string) =>
    `${b64url({ alg: "HS256" })}.${b64url({ exp: Math.floor(Date.now() / 1000) + seconds, nonce })}.sig`;

let seen: string | null = null;
const Probe = () => {
    seen = useAuth().accessToken;
    return null;
};

describe("proactive access-token refresh (MIP-2242)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        refreshSession.mockReset();
        seen = null;
        window.history.pushState({}, "", "/chat");
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    const mountSignedIn = async (first: string) => {
        refreshSession.mockResolvedValueOnce({ kind: "ok", access: first });
        render(
            <AuthProvider>
                <Probe />
            </AuthProvider>
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(seen).toBe(first);
        expect(refreshSession).toHaveBeenCalledTimes(1);
    };

    it("renews 5 minutes before a 30 minute token expires, without a 401", async () => {
        const first = tokenExpiringIn(30 * 60, "a");
        const second = tokenExpiringIn(60 * 60, "b");
        await mountSignedIn(first);
        refreshSession.mockResolvedValueOnce({ kind: "ok", access: second });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(24 * 60 * 1000);
        });
        expect(refreshSession).toHaveBeenCalledTimes(1); // not yet

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
        });
        expect(refreshSession).toHaveBeenCalledTimes(2);
        expect(seen).toBe(second);
    });

    it("retries after a network failure instead of signing out", async () => {
        const first = tokenExpiringIn(30 * 60, "a");
        const second = tokenExpiringIn(60 * 60, "b");
        await mountSignedIn(first);
        refreshSession.mockResolvedValueOnce({ kind: "transient" });
        refreshSession.mockResolvedValueOnce({ kind: "ok", access: second });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(25 * 60 * 1000 + 500);
        });
        expect(seen).toBe(first);
        expect(refreshSession).toHaveBeenCalledTimes(2);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2_500);
        });
        expect(refreshSession).toHaveBeenCalledTimes(3);
        expect(seen).toBe(second);
    });

    it("renews at once when the tab comes back inside the window", async () => {
        const first = tokenExpiringIn(30 * 60, "a");
        const second = tokenExpiringIn(60 * 60, "b");
        await mountSignedIn(first);
        refreshSession.mockResolvedValueOnce({ kind: "ok", access: second });

        // The timer did not run (a frozen background tab); the clock moved on without it.
        vi.setSystemTime(Date.now() + 27 * 60 * 1000);
        await act(async () => {
            document.dispatchEvent(new Event("visibilitychange"));
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(seen).toBe(second);
    });
});
