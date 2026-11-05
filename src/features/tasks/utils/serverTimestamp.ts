// The form a task's `updatedAt` has in the IndexedDB row cache and in
// `getProjectTasks` / `getTask`: Python's `str(datetime)`, e.g.
// "2026-11-02 16:13:23.294468+00:00". A DRF model serialiser (the create / save
// responses' `task.ts_updated_at`) writes the same instant as ISO,
// "2026-11-02T16:13:23.294468Z".
//
// The two are not interchangeable here: several readers compare `updatedAt`
// as plain strings (the full-task cache's freshness guard in
// `loadSpecificTask`, the "row is newer than the preview" check in
// `useProjectTaskManagement`). "T" sorts after " ", so an ISO value would
// always beat a server-form one from the same day, whatever the clock says.
// Anything that caches a time from a response goes through this first.
//
// Zone-less input stays zone-less (the app's own local form,
// `getLocalCurrentTimestamp`). Anything that is not a time is null, and the
// caller keeps what it had.
const TIMESTAMP =
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/;

export const toServerTimestamp = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const match = TIMESTAMP.exec(value.trim());
    if (!match) return null;
    const [, date, time, zone] = match;
    if (zone === undefined) return `${date} ${time}`;
    if (zone === "Z") return `${date} ${time}+00:00`;
    const digits = zone.slice(1).replace(":", "").padEnd(4, "0");
    return `${date} ${time}${zone[0]}${digits.slice(0, 2)}:${digits.slice(2)}`;
};
