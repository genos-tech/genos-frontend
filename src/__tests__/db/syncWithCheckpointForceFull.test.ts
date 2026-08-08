/**
 * `syncWithCheckpoint`'s `forceFull` escape hatch.
 *
 * The incremental sync only ever asks the server for changes SINCE the
 * stored watermark. That is exactly wrong for a row that changed without
 * moving the field the delta keys on — the motivating case is
 * `Activity.is_read`: the model has no `ts_updated_at`, the feed delta is
 * keyed on `ts_created_at`, so an activity marked read on ANOTHER device is
 * never in any "changes since" answer and its unread badge stays lit until a
 * full reload. The wake refresh sets `forceFull` to get that full reload.
 *
 * These tests assert the two guarantees `forceFull` must hold:
 *   1. it fetches with `since=null` (the whole window) even when a
 *      checkpoint exists, and the applier is told it's a full load
 *      (`hadCheckpoint=false` → clear-before-insert);
 *   2. it still advances the checkpoint, so the NEXT sync goes back to
 *      incremental.
 *
 * Real in-memory IndexedDB (fake-indexeddb) so the checkpoint store behaves
 * as it does in the browser.
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../../db/config";
import { CheckpointRepository } from "../../db/repositories/checkpoints";
import { syncWithCheckpoint } from "../../db/workers/utils/syncWithCheckpoint";

// initDB never closes the connections it opens; deleteDB then logs a
// `blocking` warning as it forces them shut. Expected teardown noise.
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
afterAll(() => warnSpy.mockRestore());

const KEY = "activity-test";

describe("syncWithCheckpoint forceFull", () => {
    beforeEach(async () => {
        await deleteDB(DB_NAME);
    });

    it("ignores the stored checkpoint and fetches the whole window", async () => {
        await new CheckpointRepository().setCheckpoint(KEY, "T1");

        const fetcher = vi.fn().mockResolvedValue({ serverTime: "T2", data: ["row"] });
        const applier = vi.fn().mockResolvedValue(undefined);

        await syncWithCheckpoint({ key: KEY, forceFull: true, fetcher, applier });

        // A checkpoint existed (T1), yet the fetch asked for `since=null`.
        expect(fetcher).toHaveBeenCalledWith(null);
        // And the applier was told to treat it as a full load
        // (clear-before-insert), NOT an incremental upsert.
        expect(applier).toHaveBeenCalledWith(["row"], false);
    });

    it("still advances the checkpoint so the next sync is incremental", async () => {
        await new CheckpointRepository().setCheckpoint(KEY, "T1");

        const fetcher = vi.fn().mockResolvedValue({ serverTime: "T2", data: [] });
        const applier = vi.fn().mockResolvedValue(undefined);

        // Forced full reload advances the watermark to T2.
        await syncWithCheckpoint({ key: KEY, forceFull: true, fetcher, applier });
        expect(await new CheckpointRepository().getCheckpoint(KEY)).toBe("T2");

        // The next (non-forced) sync goes back to incremental from T2.
        fetcher.mockResolvedValueOnce({ serverTime: "T3", data: [] });
        await syncWithCheckpoint({ key: KEY, fetcher, applier });
        expect(fetcher).toHaveBeenLastCalledWith("T2");
        expect(applier).toHaveBeenLastCalledWith([], true);
    });

    it("without forceFull, an existing checkpoint drives an incremental fetch", async () => {
        await new CheckpointRepository().setCheckpoint(KEY, "T1");

        const fetcher = vi.fn().mockResolvedValue({ serverTime: "T2", data: [] });
        const applier = vi.fn().mockResolvedValue(undefined);

        await syncWithCheckpoint({ key: KEY, fetcher, applier });

        expect(fetcher).toHaveBeenCalledWith("T1");
        expect(applier).toHaveBeenCalledWith([], true);
    });
});
