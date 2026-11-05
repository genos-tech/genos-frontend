/**
 * Which kind of interaction a URL change was, for the real-session timing
 * recorder (MIP-957). Pure: it only compares the two paths.
 *
 * The URL is the signal because every interaction worth timing changes it
 * (`useTaskRouting`, `useNoteRouting`, the project switch and the service rail
 * all write the route), so no component needs a hook, and the same rule covers
 * a click, a keyboard shortcut and a link.
 */

export type PerfNavigationKind =
    | "task_open"
    | "task_switch"
    | "note_open"
    | "note_switch"
    | "project_switch"
    | "service_switch";

const WORKSPACE = /^\/workspace\/([^/]+)(?:\/(.*))?$/;

/** `/workspace/tasks/project/295` → "tasks" (null outside `/workspace/<service>`).
 *  Also used by the service-switch loader (MIP-965) to tell a service switch
 *  from a navigation inside one service. */
export const serviceOf = (path: string): string | null => WORKSPACE.exec(path)?.[1] ?? null;

/** `/workspace/tasks/project/295/task/12` → { project: "295", item: "task/12" } */
const taskRoute = (path: string): { project: string | null; item: string | null } => {
    const rest = WORKSPACE.exec(path)?.[2] ?? "";
    const m = /^project\/([^/]+)(?:\/(task|milestone)\/([^/]+))?/.exec(rest);
    if (!m) return { project: null, item: null };
    return { project: m[1], item: m[2] ? `${m[2]}/${m[3]}` : null };
};

/** `/workspace/notes/my/1199` → "my/1199" (null for the bare notes page). */
const noteItem = (path: string): string | null => {
    const rest = WORKSPACE.exec(path)?.[2] ?? "";
    const m = /^([^/]+\/[^/]+)/.exec(rest);
    return m ? m[1] : null;
};

export const classifyNavigation = (
    prevPath: string | null,
    nextPath: string
): PerfNavigationKind | null => {
    const nextService = serviceOf(nextPath);
    if (!nextService) return null;

    const prevService = prevPath ? serviceOf(prevPath) : null;
    if (prevPath !== null && prevService !== nextService) return "service_switch";
    if (prevPath === null) return null;

    if (nextService === "tasks") {
        const prev = taskRoute(prevPath);
        const next = taskRoute(nextPath);
        if (next.item && next.item !== prev.item) {
            return prev.item ? "task_switch" : "task_open";
        }
        if (next.project && next.project !== prev.project) return "project_switch";
        return null;
    }

    if (nextService === "notes") {
        const prev = noteItem(prevPath);
        const next = noteItem(nextPath);
        if (next && next !== prev) return prev ? "note_switch" : "note_open";
        return null;
    }

    return null;
};
