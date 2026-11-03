import { TaskTableProps } from "../../../types/tasks";

/** How many projects' rows are in memory at once, the open one included (its
 *  rows are `allTasks`; the cache holds the rest). About 1 MB per 950-row
 *  project, so about 5 MB at most. */
export const MAX_CACHED_PROJECTS = 5;

/** A nothing-to-show table. One shared array, so "no rows" is the same value
 *  everywhere and `allTasks.length === 0` memos do not see a new identity. */
export const NO_ROWS: TaskTableProps[] = [];

/** The key of one project's rows, in the scope (team) they were read in. A
 *  shared project seen from the guest's team and from the host's are two
 *  entries. */
export const projectRowsKey = (scope: string, projectId: number | string): string =>
    `${scope}:${projectId}`;

/**
 * The rows of the projects the user was in lately, other than the open one,
 * kept in memory so a switch back can paint them in the same render instead of
 * waiting for IndexedDB.
 *
 * The open project's rows live in `allTasks`; leaving a project `put`s them
 * here, and opening one `take`s them out (so a project is in memory once, and
 * the open one plus this cache hold `MAX_CACHED_PROJECTS` at most). The least
 * recently used entry goes first (a `Map` iterates in insertion order).
 * Entries are plain snapshots, only ever a first paint: the reconcile read that
 * follows a switch corrects them.
 *
 * Not React state: nothing renders from it directly, and dropping an entry
 * must not cost a render.
 */
export class ProjectRowsCache {
    private readonly entries = new Map<string, TaskTableProps[]>();

    constructor(private readonly capacity: number = MAX_CACHED_PROJECTS - 1) {}

    get size(): number {
        return this.entries.size;
    }

    keys(): string[] {
        return [...this.entries.keys()];
    }

    /** The cached rows without touching the cache (safe to call while
     *  rendering); undefined on a miss. */
    peek(key: string): TaskTableProps[] | undefined {
        return this.entries.get(key);
    }

    /** The cached rows, removed from the cache (they are the open project's
     *  now); undefined on a miss. */
    take(key: string): TaskTableProps[] | undefined {
        const rows = this.entries.get(key);
        if (rows !== undefined) this.entries.delete(key);
        return rows;
    }

    /** Store (or replace) the rows as the most recently used, then evict the
     *  oldest entries beyond the capacity. */
    put(key: string, rows: TaskTableProps[]): void {
        this.entries.delete(key);
        this.entries.set(key, rows);
        this.trim();
    }

    private trim(): void {
        while (this.entries.size > this.capacity) {
            const oldest = this.entries.keys().next().value;
            if (oldest === undefined) return;
            this.entries.delete(oldest);
        }
    }

    delete(key: string): void {
        this.entries.delete(key);
    }

    /** Drop a project's rows in every scope. */
    deleteProject(projectId: number | string): void {
        const suffix = `:${projectId}`;
        for (const key of [...this.entries.keys()]) {
            if (key.endsWith(suffix)) this.entries.delete(key);
        }
    }

    /** Drop every project that is not in `keep`, in every scope. */
    retainProjects(keep: Iterable<number | string>): void {
        const wanted = new Set([...keep].map((id) => `:${id}`));
        for (const key of [...this.entries.keys()]) {
            const suffix = key.slice(key.lastIndexOf(":"));
            if (!wanted.has(suffix)) this.entries.delete(key);
        }
    }

    clear(): void {
        this.entries.clear();
    }
}

/** The rows that belong to `projectId`. Returns `rows` itself when every row
 *  does (no copy, same identity); a row with no project is kept, a row of
 *  another project (`loadUpdatedTask` can upsert one) is not. */
export const rowsOfProject = (rows: TaskTableProps[], projectId: number): TaskTableProps[] => {
    const wanted = String(projectId);
    const mine = rows.filter((row) => row.projectId == null || String(row.projectId) === wanted);
    return mine.length === rows.length ? rows : mine;
};
