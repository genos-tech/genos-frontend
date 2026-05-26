import { TaskTableProps } from "../../../../types/tasks";
import { TaskGraph } from "../types";

// Sentinel key for the "no parent" group (the diagram's root). Outside
// any legitimate task-id range so it can't collide with a real parent.
const ROOT_GROUP_KEY = -1;

/**
 * Re-orders `tasks` for the diagram so sibling columns under each
 * parent are (1) sorted by task id ascending and (2) clustered when
 * pairs of siblings block / are-blocked-by each other. Within a
 * cluster, members are ordered by dependency direction — blocker on
 * the left, blocked on the right — via a topological sort with id
 * tiebreaks. Cluster footprint (its left-edge position relative to
 * non-cluster siblings) is still determined by the cluster's smallest
 * id, so clusters slot in with the rest of the id-ordered siblings.
 *
 * Adjacency is sibling-scoped: dependency edges with an external
 * endpoint, a hidden-by-filter endpoint, or endpoints under different
 * parents are ignored — those cases can't be expressed by reordering
 * within a single parent's children. The dagre layout never sees the
 * dependency edges (by design — see useDagreLayout.ts), so this
 * pre-sort is the only lever for sibling column order.
 *
 * Parent groups are emitted in first-appearance order, preserving the
 * BFS top-down rank ordering produced by loadTaskGraph.
 *
 * IMPORTANT — dagre quirk: dagre v3's order phase places the
 * LAST-added successor of a parent at the LEFTMOST column. So to
 * render `[A, B, C, D]` left-to-right we must call setEdge in order
 * `[D, C, B, A]`. The canvas iterates this array verbatim when
 * calling setEdge, so we reverse each parent group at the end —
 * the function returns siblings in REVERSE visual order. Two
 * reverses (ours + dagre's) cancel out to the order we actually want.
 */
export const sortDiagramTasks = (
    tasks: TaskTableProps[],
    dependencyEdges: TaskGraph["dependencyEdges"]
): TaskTableProps[] => {
    if (tasks.length === 0) return tasks;

    const groups = new Map<number, TaskTableProps[]>();
    const firstAppearance = new Map<number, number>();
    for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const key = t.parentTaskId == null ? ROOT_GROUP_KEY : Number(t.parentTaskId);
        if (!groups.has(key)) {
            groups.set(key, []);
            firstAppearance.set(key, i);
        }
        groups.get(key)!.push(t);
    }

    // Union-find with smaller-id-wins so each cluster's representative
    // is its smallest member — gives us a stable cluster sort key.
    const parent = new Map<number, number>();
    const find = (x: number): number => {
        const p = parent.get(x);
        if (p === undefined || p === x) {
            parent.set(x, x);
            return x;
        }
        const root = find(p);
        parent.set(x, root);
        return root;
    };
    const union = (a: number, b: number) => {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) return;
        if (ra < rb) parent.set(rb, ra);
        else parent.set(ra, rb);
    };

    for (const [, group] of groups) {
        const idSet = new Set(group.map((t) => Number(t.id)));
        for (const d of dependencyEdges) {
            if (idSet.has(d.blockerTaskId) && idSet.has(d.blockedTaskId)) {
                union(d.blockerTaskId, d.blockedTaskId);
            }
        }
    }

    // Per-cluster topological order so blocker sits left of blocked.
    // Ties (multiple roots, multiple successors freed in one step)
    // break by id ascending so the "ordered by id" guarantee still
    // holds whenever topology leaves a choice. Cycles are pathological
    // for task deps; if one slips through, leftover nodes get
    // appended in id order so the diagram still renders.
    const clusterMembers = new Map<number, number[]>();
    for (const t of tasks) {
        const id = Number(t.id);
        const root = find(id);
        if (!clusterMembers.has(root)) clusterMembers.set(root, []);
        clusterMembers.get(root)!.push(id);
    }

    const positionInCluster = new Map<number, number>();
    for (const [, members] of clusterMembers) {
        if (members.length === 1) {
            positionInCluster.set(members[0], 0);
            continue;
        }
        const memberSet = new Set(members);
        const inDegree = new Map<number, number>();
        const successors = new Map<number, number[]>();
        for (const m of members) {
            inDegree.set(m, 0);
            successors.set(m, []);
        }
        for (const d of dependencyEdges) {
            if (memberSet.has(d.blockerTaskId) && memberSet.has(d.blockedTaskId)) {
                successors.get(d.blockerTaskId)!.push(d.blockedTaskId);
                inDegree.set(d.blockedTaskId, (inDegree.get(d.blockedTaskId) ?? 0) + 1);
            }
        }
        const ordered: number[] = [];
        const ready: number[] = [];
        for (const m of members) {
            if (inDegree.get(m) === 0) ready.push(m);
        }
        ready.sort((a, b) => a - b);
        while (ready.length > 0) {
            const next = ready.shift()!;
            ordered.push(next);
            for (const successor of successors.get(next) ?? []) {
                const newDeg = (inDegree.get(successor) ?? 0) - 1;
                inDegree.set(successor, newDeg);
                if (newDeg === 0) {
                    let lo = 0;
                    let hi = ready.length;
                    while (lo < hi) {
                        const mid = (lo + hi) >>> 1;
                        if (ready[mid] < successor) lo = mid + 1;
                        else hi = mid;
                    }
                    ready.splice(lo, 0, successor);
                }
            }
        }
        if (ordered.length < members.length) {
            const seen = new Set(ordered);
            const leftover = members.filter((m) => !seen.has(m)).sort((a, b) => a - b);
            ordered.push(...leftover);
        }
        for (let i = 0; i < ordered.length; i++) {
            positionInCluster.set(ordered[i], i);
        }
    }

    const orderedGroupKeys = [...groups.keys()].sort(
        (a, b) => (firstAppearance.get(a) ?? 0) - (firstAppearance.get(b) ?? 0)
    );
    const out: TaskTableProps[] = [];
    for (const key of orderedGroupKeys) {
        const group = groups.get(key)!;
        const sorted = [...group].sort((a, b) => {
            const aId = Number(a.id);
            const bId = Number(b.id);
            const aCluster = find(aId);
            const bCluster = find(bId);
            if (aCluster !== bCluster) return aCluster - bCluster;
            return (positionInCluster.get(aId) ?? 0) - (positionInCluster.get(bId) ?? 0);
        });
        // Reverse per the dagre quirk noted in the doc comment: last
        // setEdge call wins leftmost, so the desired-leftmost task
        // must come LAST in the array the structure-edges loop walks.
        sorted.reverse();
        out.push(...sorted);
    }

    return out;
};
