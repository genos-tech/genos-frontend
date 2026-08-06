/**
 * Switching teams must not leave the inbox permanently empty.
 *
 * The inbox syncs incrementally: a checkpoint records "I hold everything up
 * to here" and the next sync asks only for changes since. That watermark and
 * the rows it vouches for are kept consistent by one thing — the team switch
 * wipes the inbox store and the checkpoint store together — so the new team's
 * first sync finds no checkpoint and does a full load.
 *
 * When a sync got in before that wipe, it read the PREVIOUS team's watermark,
 * asked for changes since a moment when the new team had loaded nothing, and
 * got the ~empty answer that a changes-since query must give. The wipe then
 * landed on top, emptying the store, and the sync finished by writing a fresh
 * watermark over it — leaving "I hold everything" stamped on an empty inbox.
 * Nothing re-asked (App refreshes once per team), so the items stayed gone
 * until a reload, including on the trip back to the team that had them.
 *
 * Two halves, tested here in order: the wipe really does reset the inbox to a
 * full load, and `currentTeamId` — which is what triggers the sync — is not
 * published until the wipe has finished.
 *
 * Real in-memory IndexedDB (fake-indexeddb) so the checkpoint store and the
 * inbox store behave as they do in the browser.
 */

import "fake-indexeddb/auto";

import { act, renderHook, waitFor } from "@testing-library/react";
import { deleteDB } from "idb";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../../db/config";
import { InboxRepository } from "../../db/repositories";
import { CheckpointRepository } from "../../db/repositories/checkpoints";
import { DatabaseUtils } from "../../db/utils/database";
import { inboxHandlers } from "../../db/workers/handlers/inbox.handlers";
import { loadInbox, type InboxDeltaItem } from "../../features/inbox/services/loadInbox";
import { useTeamManagement } from "../../hooks/common/useTeamManagement";
import type { UserProps } from "../../types/admin";

vi.mock("../../features/inbox/services/loadInbox", () => ({
    loadInbox: vi.fn(),
}));
vi.mock("../../features/admin/services/findTeam", () => ({
    findTeam: vi.fn(async () => ({ exist: false })),
}));
vi.mock("../../features/admin/services/loadMyTeams", () => ({
    loadMyTeams: vi.fn(async () => []),
    membershipTeams: (teams: unknown[] = []) => teams,
}));
vi.mock("../../features/admin/services/popTeamMembers", () => ({
    popTeamMembers: vi.fn(async () => []),
}));
vi.mock("../../db/workers/channels", () => ({
    usersChannel: { request: vi.fn(async () => ({})) },
}));

// initDB never closes the connections it opens; deleteDB then logs a
// `blocking` warning as it forces them shut. Expected teardown noise.
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
afterAll(() => warnSpy.mockRestore());

const TEAM_A = "team-a";
const TEAM_B = "team-b";

const inTeam = (teamId: string) => ({ userId: "u-1", teamId }) as UserProps;

const item = (itemId: number): InboxDeltaItem =>
    ({
        itemId,
        itemBody: [],
        itemType: 1,
        isRead: false,
        requestStatus: "pending",
        tsSent: `2026-08-0${itemId}T00:00:00Z`,
    }) as InboxDeltaItem;

const answer = (items: InboxDeltaItem[], serverTime: string) => ({ serverTime, items });

const syncInbox = (teamId: string) =>
    inboxHandlers.loadInbox({ myself: inTeam(teamId), accessToken: "token" } as never);

const sinceOfCall = (call: number): string | null => vi.mocked(loadInbox).mock.calls[call][3];

const storedIds = async () => {
    const result = await new InboxRepository().getAll();
    return (result.data ?? []).map((row) => row.itemId).sort();
};

describe("the inbox across a team switch", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await deleteDB(DB_NAME);
    });

    it("reloads in full for the new team once the wipe has run", async () => {
        vi.mocked(loadInbox).mockResolvedValueOnce(answer([item(1), item(2)], "T1"));
        await syncInbox(TEAM_A);
        expect(await storedIds()).toEqual([1, 2]);

        await DatabaseUtils.clearTeamScopedStores();
        // The wipe has to take the watermark with the rows. Left behind, it
        // would turn the next sync into a changes-since against a store that
        // no longer holds anything.
        expect(await new CheckpointRepository().getCheckpoint("inbox")).toBeNull();

        vi.mocked(loadInbox).mockResolvedValueOnce(answer([item(7)], "T2"));
        await syncInbox(TEAM_B);

        expect(sinceOfCall(1)).toBeNull();
        expect(await storedIds()).toEqual([7]);
    });

    it("refills the team you came back to", async () => {
        vi.mocked(loadInbox).mockResolvedValueOnce(answer([item(1), item(2)], "T1"));
        await syncInbox(TEAM_A);
        await DatabaseUtils.clearTeamScopedStores();
        vi.mocked(loadInbox).mockResolvedValueOnce(answer([item(7)], "T2"));
        await syncInbox(TEAM_B);
        await DatabaseUtils.clearTeamScopedStores();

        // A → B → A, the reported trip: back in the team that visibly had
        // items, with all of them gone.
        vi.mocked(loadInbox).mockResolvedValueOnce(answer([item(1), item(2)], "T3"));
        await syncInbox(TEAM_A);

        expect(sinceOfCall(2)).toBeNull();
        expect(await storedIds()).toEqual([1, 2]);
    });

    it("still syncs incrementally while the team stays put", async () => {
        vi.mocked(loadInbox).mockResolvedValueOnce(answer([item(1)], "T1"));
        await syncInbox(TEAM_A);

        // The point of the checkpoint: no wipe, so a second sync in the same
        // team asks only for what changed and adds to what is already held.
        vi.mocked(loadInbox).mockResolvedValueOnce(answer([item(2)], "T2"));
        await syncInbox(TEAM_A);

        expect(sinceOfCall(1)).toBe("T1");
        expect(await storedIds()).toEqual([1, 2]);
    });
});

describe("the team id everything else keys off", () => {
    it("is not published by useTeamManagement, which cannot know about the wipe", async () => {
        const { result, rerender } = renderHook(
            ({ myself }) => useTeamManagement(myself, "token"),
            { initialProps: { myself: inTeam(TEAM_A) } }
        );

        // `useAppInitialization` is the sole writer: it sets this only after
        // `clearTeamScopedStores()` resolves. A second writer here would
        // publish the new team while that wipe was still in flight, and the
        // refresh it triggers — the inbox sync among it — would run against
        // the old team's cache and watermark.
        await act(async () => {
            rerender({ myself: inTeam(TEAM_B) });
        });
        expect(result.current.currentTeamId).toBe("");

        await act(async () => {
            result.current.setCurrentTeamId(TEAM_B);
        });
        await waitFor(() => expect(result.current.currentTeamId).toBe(TEAM_B));
    });
});
