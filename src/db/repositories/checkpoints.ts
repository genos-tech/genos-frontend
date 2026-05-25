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
}
