import { CheckpointRepository } from "../../repositories/checkpoints";

const checkpointRepo = new CheckpointRepository();

export interface DeltaResponse<T> {
    serverTime: string;
    data: T;
    // When the server's catastrophic-delta cap kicks in (client checkpoint
    // older than MAX_DELTA_AGE_DAYS), the backend re-runs the query as a
    // full load and sets this flag so the applier wipes the IDB store
    // before inserting — preventing stale data from leaking through.
    forceFull?: boolean;
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

    // Force a full reload even when a checkpoint exists: fetch the whole
    // window (`since=null`) and clear-before-insert. Needed when rows can
    // change server-side WITHOUT moving the field the incremental delta
    // keys on — e.g. `Activity.is_read` flips on another device but
    // `Activity` has no `ts_updated_at`, so a `ts_created_at`-keyed delta
    // never re-fetches the now-read row and its unread badge stays stale.
    // The new checkpoint is still persisted afterward, so the NEXT sync
    // returns to incremental.
    forceFull?: boolean;
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
    // `forceFull` (caller-driven) overrides the stored checkpoint so the
    // fetcher pulls the whole window — used by the wake refresh to re-sync
    // read state that an incremental delta can't see (see the option's doc).
    const since = opts.forceFull ? null : await checkpointRepo.getCheckpoint(opts.key);
    const response = await opts.fetcher(since);
    // `hadCheckpoint=false` makes the applier treat this as a full load
    // (clear-before-insert). We force that when the client truly has no
    // checkpoint, the caller asked for a full reload, OR the server told
    // us to (catastrophic-delta).
    const hadCheckpoint = since !== null && !response.forceFull;
    await opts.applier(response.data, hadCheckpoint);
    await checkpointRepo.setCheckpoint(opts.key, response.serverTime);
}
