// Centralizes the "what does the user see when we refer to a task by
// id?" decision. Used by every UI surface that renders a task identifier
// — table, sprint board, preview header, chips, search results, thread
// header, activity feed, recents sidebar, dashboard widgets.
//
// Default path: the backend provides `displayId` (e.g. "GEN-42") on every
// task response. Fallback to "#<id>" for tasks with no project / pre-
// migration rows / partial state where the new field hasn't loaded yet.

// Tasks come through several different API shapes. Some surfaces use
// `id` (TaskTableProps, TaskProps), others use `taskId` (Recents,
// SearchBox, ActivityTypeChips). Accept either so callers don't have
// to remember which field their row carries.
type TaskLike = {
    displayId?: string | null;
    id?: number | string | null;
    taskId?: number | string | null;
};

export const formatTaskDisplayId = (task: TaskLike | null | undefined): string => {
    if (!task) return "";
    if (task.displayId) return task.displayId;
    const numeric = task.id ?? task.taskId;
    if (numeric != null && numeric !== "") return `#${numeric}`;
    return "";
};

// ── Finding a task by what the user typed (MIP-739) ───────────────────
// People type an id the way they read it: "MIP-739", "mip-739", "#MIP-739",
// "mip739" or just "739". Case, a leading "#", spaces and the hyphen don't
// matter.
const normalizeIdText = (text: string): string =>
    text.trim().toLowerCase().replace(/^#/, "").replace(/[\s-]/g, "");

/** Whether `query` names (part of) this display id. */
export const displayIdMatches = (query: string, displayId: string | null | undefined): boolean => {
    const q = normalizeIdText(query);
    return q.length > 0 && !!displayId && normalizeIdText(displayId).includes(q);
};

/** Whether `query` names this display id exactly. */
export const displayIdEquals = (query: string, displayId: string | null | undefined): boolean =>
    !!displayId && normalizeIdText(query) === normalizeIdText(displayId);

// A whole id: a project code (a letter, then 1-5 letters or digits) and a number.
const FULL_DISPLAY_ID = /^#?([A-Za-z][A-Za-z0-9]{1,5}-\d{1,9})$/;

/** The id in `query` if it is a whole display id ("#mip-12" → "mip-12"). */
export const fullDisplayIdIn = (query: string): string | null =>
    FULL_DISPLAY_ID.exec(query.trim())?.[1] ?? null;

// A query that is NOTHING BUT a task id (MIP-1040: Spotlight's search by id). Spelled the
// way people type it: case, a leading "#", a hyphen, spaces around it, a space
// instead of it, or nothing at all when the code is letters ("mip890"). Words
// beside the id ("MIP-890 chips") make it an ordinary search, not an id.
const ID_ONLY = /^#?\s*([A-Za-z][A-Za-z0-9]{1,5})(?:\s*-\s*|\s+)(\d{1,9})$/;
const ID_ONLY_COMPACT = /^#?([A-Za-z]{2,6})(\d{1,9})$/;

/** The display id ("MIP-890") a query consists of, or null when it is anything else.
 *  The number is the task's whole number: "MIP-89" is task 89, not a prefix. */
export const displayIdOnlyQuery = (query: string): string | null => {
    const q = query.trim();
    const m = ID_ONLY.exec(q) ?? ID_ONLY_COMPACT.exec(q);
    return m ? `${m[1].toUpperCase()}-${Number(m[2])}` : null;
};

/** True when the user found this task by its id rather than its title:
 *  the query matches the id and the title doesn't contain it. A chip
 *  picked this way is inserted compact (`#MIP-739`). */
export const pickedByDisplayId = (
    query: string,
    displayId: string | null | undefined,
    title: string | null | undefined
): boolean => {
    const q = query.trim().toLowerCase();
    return displayIdMatches(q, displayId) && !(title ?? "").toLowerCase().includes(q);
};

/** A task chip's text: "PRJ-12 · <title>", or "PRJ-12" for a compact chip. */
export const hashTaskLabel = ({
    taskId,
    displayId,
    title,
    labelMode,
}: {
    taskId: string;
    displayId?: string;
    title?: string;
    labelMode?: string;
}): string => {
    const idText = displayId || taskId;
    return title && labelMode !== "id" ? `${idText} · ${title}` : idText;
};
