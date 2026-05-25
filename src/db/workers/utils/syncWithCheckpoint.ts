import { CheckpointRepository } from "../../repositories/checkpoints";

const checkpointRepo = new CheckpointRepository();

export interface DeltaResponse<T> {
    serverTime: string;
    data: T;
}

export interface SyncWithCheckpointOptions<T> {
    // Stable identifier per loader. Use plain strings ("activity",
    // "inbox", "teamMembers") for global watermarks, and a scoped form
    // ("dm:42", "tasks:7") when the same loader runs against different
    // entities and needs independent watermarks per entity.
    key: string;

    // Issue the network request. `since` is the previous checkpoint's
    // serverTime, or null on first load.
    fetcher: (since: string | null) => Promise<DeltaResponse<T>>;

    // Apply the fetched payload to IDB. `hadCheckpoint` tells the
    // applier whether this was an incremental load (true → upsert +
    // tombstone-delete) or a full load (false → clear-then-batchInsert).
    applier: (data: T, hadCheckpoint: boolean) => Promise<void>;
}

// Drive one checkpointed sync round.
//
// Flow:
//   1. Read the prior checkpoint (or null for a never-synced store).
//   2. Fetch; the backend snapshots its own clock as `serverTime`
//      BEFORE running the query, so race-safety is guaranteed.
//   3. Apply to IDB. The applier is per-data-type because each store
//      has its own shape.
//   4. ONLY then persist the new checkpoint. A throw in steps 2 or 3
//      leaves the checkpoint unmoved, and the next sync re-tries the
//      same window. (Idempotent applier required.)
export async function syncWithCheckpoint<T>(opts: SyncWithCheckpointOptions<T>): Promise<void> {
    const since = await checkpointRepo.getCheckpoint(opts.key);
    const response = await opts.fetcher(since);
    await opts.applier(response.data, since !== null);
    await checkpointRepo.setCheckpoint(opts.key, response.serverTime);
}
