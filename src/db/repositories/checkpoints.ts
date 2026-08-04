import { STORES } from "../config";
import { BaseRepository } from "./base";

// One row per loader (e.g. "activity", "dm", "tasks:<projectId>"). The
// `serverTime` value is the ISO timestamp returned by the backend's
// delta endpoint; the next sync replays it as `?since=`, so the server
// is the authority on "as-of when did I last see this data." Using a
// server-supplied watermark (rather than max(ts_updated_at) of returned
// rows) is what makes the sync race-safe against writes that commit
// during a query.
export interface CheckpointRecord {
    key: string;
    serverTime: string;
    lastUpdated: string;
}

export class CheckpointRepository extends BaseRepository<CheckpointRecord> {
    constructor() {
        super(STORES.SYNC_CHECKPOINTS);
    }

    async getCheckpoint(key: string): Promise<string | null> {
        const res = await this.get(key);
        if (!res.success || !res.data) return null;
        return res.data.serverTime;
    }

    // Only call AFTER the corresponding sync's IDB writes have committed,
    // so an in-flight failure leaves the watermark unmoved and the next
    // sync retries the same window.
    async setCheckpoint(key: string, serverTime: string): Promise<void> {
        await this.put({
            key,
            serverTime,
            lastUpdated: new Date().toISOString(),
        });
    }

    // Forget one watermark, so the next sync of that loader asks for
    // everything again.
    //
    // Whoever empties a store owes this call. A watermark says "I already
    // hold everything up to here", and after a `clear()` that is a lie the
    // server will happily agree with: it answers the next `?since=` with
    // the handful of rows that changed and the client keeps serving an
    // almost-empty store forever, with no error anywhere to explain it.
    async forgetCheckpoint(key: string): Promise<void> {
        await this.delete(key);
    }

    // Same, for the scoped keys of one loader ("tasks:7", "tasks:8", ...),
    // whose store is shared and therefore cleared as a whole.
    async forgetCheckpointsWithPrefix(prefix: string): Promise<void> {
        const res = await this.getAll();
        if (!res.success || !res.data) return;
        for (const row of res.data) {
            if (row.key.startsWith(prefix)) await this.delete(row.key);
        }
    }
}
