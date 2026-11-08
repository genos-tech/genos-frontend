/**
 * MIP-1276: every data surface says so when its request FAILED and offers Retry.
 *
 * Before this, a failed request read as an answer: the Activity tab said "No
 * activity yet", the velocity chart drew a quiet week, Settings > Integrations
 * drew "Connect" next to accounts it never loaded, and a note that failed to
 * open left a blank pane for good.
 *
 * The cases below fail at the REQUEST (axios `get` rejects), not at a stubbed
 * `loadFailed` prop, so each one covers request -> loader -> hook -> surface
 * -> Retry -> the second request landing. Mutation-checked: restore the old
 * `[]` / `res ?? []` / `return null` and the matching case fails.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataState } from "../components/ui/feedback/DataState";
import { ErrorState } from "../components/ui/feedback/ErrorState";
import { ConnectionsSection } from "../features/integrations/components/ConnectionsSection";
import { GithubRepoAccessSection } from "../features/integrations/components/GithubRepoAccessSection";
import { NoteLoadState } from "../features/notes/common/components/NoteLoadState";
import { TaskVelocitySection } from "../features/tasks/components/dashboard/TaskVelocitySection";
import { useTaskActivities } from "../features/tasks/hooks/useTaskActivities";
import { useNoteData } from "../hooks/notes/useNoteData";
import type { NoteTab } from "../hooks/notes/useNoteTabs";
import { en } from "../i18n/locales/en";
import type { UserProps } from "../types/admin";

// ---- HTTP, faked at axios -------------------------------------------------
// Each test queues answers per URL fragment: an Error rejects, anything else
// resolves as `{ data }`.
const answers = vi.hoisted(() => ({ queue: [] as Array<{ match: string; out: unknown }> }));
const calls = vi.hoisted(() => ({ urls: [] as string[] }));
vi.mock("../services/api", async (orig) => ({
    ...(await orig<typeof import("../services/api")>()),
    authApi: () => ({
        get: vi.fn(async (url: string) => {
            calls.urls.push(url);
            const i = answers.queue.findIndex((a) => url.includes(a.match));
            const hit = i >= 0 ? answers.queue.splice(i, 1)[0] : undefined;
            if (!hit) throw new Error(`unexpected request ${url}`);
            if (hit.out instanceof Error) throw hit.out;
            return { data: hit.out };
        }),
    }),
}));
const fail = (match: string) => answers.queue.push({ match, out: new Error("Network Error") });
const ok = (match: string, out: unknown) => answers.queue.push({ match, out });
const hits = (match: string) => calls.urls.filter((u) => u.includes(match)).length;

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => <span /> }));
// The note panel resolves from IndexedDB first; a cold miss is the failing case.
vi.mock("../db/services/note.service", () => ({
    NoteService: class {
        getPersonalNote = async () => undefined;
        getTaskNote = async () => undefined;
        getChatNote = async () => undefined;
    },
}));

// The mirror into IndexedDB has no IndexedDB to write to in jsdom.
vi.mock("../features/notes/common/services/addNote", () => ({ addNote: vi.fn() }));

const wrap = (ui: React.ReactNode) => <CssVarsProvider>{ui}</CssVarsProvider>;
const retry = () => screen.getByRole("button", { name: en.common.actions.retry });

beforeEach(() => {
    answers.queue.length = 0;
    calls.urls.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("ErrorState / DataState", () => {
    it("ErrorState says what failed, what to do, and Retry fires", () => {
        const onRetry = vi.fn();
        render(wrap(<ErrorState data-error="x" title="Couldn't load it" onRetry={onRetry} />));
        const box = document.querySelector('[data-error="x"]');
        expect(box?.getAttribute("role")).toBe("alert");
        expect(screen.getByText("Couldn't load it")).toBeTruthy();
        expect(screen.getByText(en.common.feedback.loadFailedBody)).toBeTruthy();
        fireEvent.click(retry());
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("xs is one line plus Retry (no body, no title block)", () => {
        render(wrap(<ErrorState size="xs" title="Couldn't load" onRetry={() => {}} />));
        expect(screen.queryByText(en.common.feedback.loadFailedBody)).toBeNull();
        expect(retry()).toBeTruthy();
    });

    const state = (p: Partial<React.ComponentProps<typeof DataState>>) =>
        render(
            wrap(
                <DataState
                    error={false}
                    errorState={{ title: "FAILED", onRetry: () => {} }}
                    empty={{ title: "EMPTY" }}
                    hasData={false}
                    loading={false}
                    skeleton={<span>SKELETON</span>}
                    {...p}
                >
                    <span>CONTENT</span>
                </DataState>
            )
        );

    it("content wins: a failed refresh keeps the rows already shown", () => {
        state({ hasData: true, error: true, loading: true });
        expect(screen.getByText("CONTENT")).toBeTruthy();
        expect(screen.queryByText("FAILED")).toBeNull();
    });
    it("loading beats error, so Retry shows the skeleton and no stale error", () => {
        state({ loading: true, error: true });
        expect(screen.getByText("SKELETON")).toBeTruthy();
        expect(screen.queryByText("FAILED")).toBeNull();
    });
    it("a failure is never the empty state", () => {
        state({ error: true });
        expect(screen.getByText("FAILED")).toBeTruthy();
        expect(screen.queryByText("EMPTY")).toBeNull();
    });
    it("empty only when the request worked; no `empty` -> the children", () => {
        state({});
        expect(screen.getByText("EMPTY")).toBeTruthy();
        document.body.innerHTML = "";
        state({ empty: undefined });
        expect(screen.getByText("CONTENT")).toBeTruthy();
    });
    it("keeps the size the caller put on `empty` when DataState has none", () => {
        state({ empty: { title: "EMPTY", size: "sm" } });
        // sm uses the smaller title level (title-sm).
        expect(screen.getByText("EMPTY").className).toMatch(/title-sm|MuiTypography-title-sm/);
    });
});

describe("Task Activity tab (useTaskActivities)", () => {
    const me = { teamId: "team-1", userId: "u1" } as UserProps;
    it("a failed load is reported, not turned into an empty history; Retry asks again", async () => {
        fail("/task/activity/");
        const { result } = renderHook(() => useTaskActivities(me, 9001));
        await waitFor(() => expect(result.current.loadFailed).toBe(true));
        expect(result.current.activities).toEqual([]);

        ok("/task/activity/", [{ activityId: 1, actionType: "created" }]);
        result.current.reload();
        await waitFor(() => expect(result.current.activities).toHaveLength(1));
        expect(result.current.loadFailed).toBe(false);
        // The failure was not cached for the TTL: Retry really hit the network.
        expect(hits("/task/activity/")).toBe(2);
    });
});

describe("Task Activity tab across tasks", () => {
    const me = { teamId: "team-1", userId: "u1" } as UserProps;
    it("task B's failed load does not show task A's rows", async () => {
        ok("/task/activity/", [{ activityId: 1, actionType: "created" }]);
        const { result, rerender } = renderHook(({ id }) => useTaskActivities(me, id), {
            initialProps: { id: 7001 },
        });
        await waitFor(() => expect(result.current.activities).toHaveLength(1));

        fail("/task/activity/");
        rerender({ id: 7002 });
        await waitFor(() => expect(result.current.loadFailed).toBe(true));
        expect(result.current.activities).toEqual([]);
    });
});

describe("Velocity chart", () => {
    const props = {
        taskIds: [1, 2],
        teamId: "team-1",
        isDark: false,
        textPrimary: "#000",
        textSecondary: "#333",
        textMuted: "#999",
    };
    it("a failed request shows Retry instead of an empty chart, and Retry redraws", async () => {
        fail("/task/velocity/");
        render(wrap(<TaskVelocitySection {...props} />));
        await screen.findByText(en.tasks.dashboard.velocity.loadFailed);
        expect(screen.queryByText(/created, .* started/)).toBeNull();

        ok("/task/velocity/", {
            velocity: [{ date: "2026-07-01", created: 2, started: 1, closed: 0, updated: 3 }],
        });
        fireEvent.click(retry());
        await screen.findByText(/2 created, 1 started, 0 closed, 3 updated/);
        expect(screen.queryByText(en.tasks.dashboard.velocity.loadFailed)).toBeNull();
    });
});

describe("Settings > Integrations", () => {
    it("connections: a failed load is not drawn as 'no accounts'; Retry shows them", async () => {
        fail("/integrations/me/");
        render(wrap(<ConnectionsSection accessToken="tok" />));
        await screen.findByText(en.integrations.connections.loadFailed);
        expect(screen.queryByText(en.integrations.connections.connect)).toBeNull();

        ok("/integrations/me/", { connections: [] });
        fireEvent.click(retry());
        await screen.findAllByText(en.integrations.connections.connect);
        expect(screen.queryByText(en.integrations.connections.loadFailed)).toBeNull();
    });

    it("repo access: a failed load shows Retry, not the 'no repositories' empty state", async () => {
        fail("/github/accessible-repos/");
        render(wrap(<GithubRepoAccessSection accessToken="tok" />));
        await screen.findByText(en.integrations.github.repoAccess.loadFailed);
        expect(screen.queryByText(en.integrations.github.repoAccess.empty)).toBeNull();

        ok("/github/accessible-repos/", {
            repos: [],
            owners: [],
            truncated: false,
            manage_url: null,
        });
        fireEvent.click(retry());
        // The request worked and found nothing: that IS the empty state.
        await screen.findByText(en.integrations.github.repoAccess.empty);
        expect(screen.queryByText(en.integrations.github.repoAccess.loadFailed)).toBeNull();
    });
});

describe("Note editor panels (useNoteData + NoteLoadState)", () => {
    const me = { teamId: "team-1", userId: "u1" } as UserProps;
    const tab = { id: "my-77", kind: "my", noteId: 77, title: "x", teamId: "team-1" } as NoteTab;

    it("a note that fails to open reports the error, and reload fetches again", async () => {
        fail("/note/personal/single/");
        const { result } = renderHook(() => useNoteData(tab, { myself: me, accessToken: "tok" }));
        await waitFor(() => expect(result.current.error).not.toBeNull());
        expect(result.current.note).toBeNull();

        ok("/note/personal/single/", {
            noteId: 77,
            noteType: 1,
            title: "Plan",
            body: "[]",
            teamId: "team-1",
            userId: "u1",
        });
        result.current.reload();
        await waitFor(() => expect(result.current.note?.title).toBe("Plan"));
        expect(result.current.error).toBeNull();
    });

    it("NoteLoadState: blank while loading, Retry on error, hidden with an inactive tab", () => {
        const onRetry = vi.fn();
        const { container, rerender } = render(
            wrap(<NoteLoadState error={false} isActive isLoading onRetry={onRetry} />)
        );
        expect(container.textContent).toBe("");
        rerender(wrap(<NoteLoadState error isActive isLoading={false} onRetry={onRetry} />));
        expect(screen.getByText(en.notes.editor.loadFailed)).toBeTruthy();
        fireEvent.click(retry());
        expect(onRetry).toHaveBeenCalledTimes(1);
        rerender(
            wrap(<NoteLoadState error isActive={false} isLoading={false} onRetry={onRetry} />)
        );
        const host = screen
            .getByText(en.notes.editor.loadFailed)
            .closest("[data-error]")?.parentElement;
        expect(host && getComputedStyle(host).display).toBe("none");
    });
});
