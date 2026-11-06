import type { Edge, Node } from "@xyflow/react";

/**
 * Default positions for the task graph (MIP-1094).
 *
 * The graph used to be laid out by dagre from parent-child edges alone: one row per
 * generation, so a milestone with 28 tasks drew all 28 side by side (8,000+ px) and
 * dependencies, which dagre never saw, only nudged the order inside that row.
 *
 * The rules here, so the picture reads as a plan:
 *
 *  1. A parent sits ABOVE its children and is centred over them.
 *  2. A blocker sits LEFT of what it blocks. A card's column is the length of the
 *     longest chain of blockers before it, so width follows the longest chain of
 *     work, not the number of siblings. Tasks that can run in parallel stack in
 *     the same column.
 *  3. Each subtree is a block. Blocks whose columns don't overlap share a row
 *     (so phases form a staircase, not a tower); the rest stack in lanes.
 *  4. Tasks with no dependency anywhere inside them have no column of their own:
 *     they wrap into rows of about FREE_ROW_COLUMNS cards, so thirty unrelated
 *     tasks make a block, not a 9,000 px line.
 *  5. An outside task (a "ghost") is drawn in the group of the card it connects to.
 *  6. The result is deterministic: ties break by task id, and a dependency loop
 *     (should one exist) drops one edge instead of hanging.
 *
 * Pure and self-contained: no state, no DOM, no layout library. Card and edge
 * drawing are unchanged; only positions come from here.
 */

export const NODE_WIDTH = 260;
export const NODE_HEIGHT = 140;
/** Horizontal gap between cards. */
export const COL_GAP = 50;
/** Vertical gap between a parent card and the group of its children. */
export const RANK_GAP = 90;
/** Vertical gap between rows of cards inside a group. */
export const LANE_GAP = 50;
/** Unrelated tasks wrap after about this many cards per row. */
export const FREE_ROW_COLUMNS = 5;
export const MARGIN = 24;

const COL_STEP = NODE_WIDTH + COL_GAP;

export type DiagramLayoutInput = {
    /** Every card to place, internal tasks and ghosts. */
    nodeIds: readonly number[];
    /** The task the diagram is rooted at. Never moved into another group. */
    rootId: number | null;
    /** child -> parent, for the internal tasks that have a visible parent. */
    parentOf: ReadonlyMap<number, number>;
    /** blocker -> blocked. Edges to an unknown id are ignored. */
    dependencies: ReadonlyArray<{ blocker: number; blocked: number }>;
    /** Outside tasks: drawn next to the card they connect to. */
    ghostIds: ReadonlySet<number>;
};

export type Position = { x: number; y: number };

/**
 * Column of every card: the length of the longest chain of blockers before it.
 * A loop has no first card, so the DFS drops the edge that closes it (the lowest
 * id is visited first, so which edge goes is the same every time).
 */
export const dependencyColumns = (
    ids: readonly number[],
    dependencies: ReadonlyArray<{ blocker: number; blocked: number }>
): Map<number, number> => {
    const known = new Set(ids);
    const out = new Map<number, number[]>();
    for (const { blocker, blocked } of dependencies) {
        if (blocker === blocked || !known.has(blocker) || !known.has(blocked)) continue;
        const list = out.get(blocker) ?? [];
        if (!list.includes(blocked)) list.push(blocked);
        out.set(blocker, list);
    }
    for (const list of out.values()) list.sort((a, b) => a - b);

    const state = new Map<number, 1 | 2>();
    const post: number[] = [];
    const dropped = new Set<string>();
    const visit = (id: number) => {
        state.set(id, 1);
        for (const next of out.get(id) ?? []) {
            const s = state.get(next);
            if (s === 1) dropped.add(`${id}>${next}`);
            else if (s === undefined) visit(next);
        }
        state.set(id, 2);
        post.push(id);
    };
    for (const id of [...known].sort((a, b) => a - b)) if (!state.has(id)) visit(id);

    const column = new Map<number, number>();
    for (const id of known) column.set(id, 0);
    for (const id of post.reverse()) {
        const here = column.get(id) ?? 0;
        for (const next of out.get(id) ?? []) {
            if (dropped.has(`${id}>${next}`)) continue;
            if ((column.get(next) ?? 0) < here + 1) column.set(next, here + 1);
        }
    }
    return column;
};

/** A laid-out subtree. `x` is absolute; `y` is relative to the block's own top. */
type Block = {
    items: Array<{ id: number; x: number; y: number }>;
    /** x-range of the cards in the block's top row: what a parent centres over. */
    tops: Array<[number, number]>;
    minX: number;
    maxX: number;
    height: number;
    /** Has a dependency somewhere inside, so its columns mean something. */
    connected: boolean;
};

const shift = (block: Block, dx: number, dy: number): Block => ({
    items: block.items.map((i) => ({ id: i.id, x: i.x + dx, y: i.y + dy })),
    tops: block.tops.map(([a, b]) => [a + dx, b + dx] as [number, number]),
    minX: block.minX + dx,
    maxX: block.maxX + dx,
    height: block.height,
    connected: block.connected,
});

const merge = (blocks: Block[], height: number): Block => ({
    items: blocks.flatMap((b) => b.items),
    tops: blocks.flatMap((b) => b.tops),
    minX: Math.min(...blocks.map((b) => b.minX)),
    maxX: Math.max(...blocks.map((b) => b.maxX)),
    height,
    connected: blocks.some((b) => b.connected),
});

/** Wrap blocks with no columns of their own into rows, left to right. */
const shelfPack = (blocks: Block[], baseX: number): Block => {
    const limit = Math.max(
        FREE_ROW_COLUMNS * COL_STEP - COL_GAP,
        ...blocks.map((b) => b.maxX - b.minX)
    );
    const placed: Block[] = [];
    let x = baseX;
    let rowTop = 0;
    let rowHeight = 0;
    for (const block of blocks) {
        const width = block.maxX - block.minX;
        if (x > baseX && x - baseX + width > limit) {
            rowTop += rowHeight + LANE_GAP;
            rowHeight = 0;
            x = baseX;
        }
        placed.push(shift(block, x - block.minX, rowTop));
        x += width + COL_GAP;
        rowHeight = Math.max(rowHeight, block.height);
    }
    return { ...merge(placed, rowTop + rowHeight), connected: false };
};

export const computeDiagramLayout = (input: DiagramLayoutInput): Map<number, Position> => {
    const ids = [...new Set(input.nodeIds)].sort((a, b) => a - b);
    const known = new Set(ids);
    const column = dependencyColumns(ids, input.dependencies);
    const hasDependency = new Set<number>();
    for (const { blocker, blocked } of input.dependencies) {
        if (blocker === blocked || !known.has(blocker) || !known.has(blocked)) continue;
        hasDependency.add(blocker);
        hasDependency.add(blocked);
    }

    // The tree: child lists in id order. A parent outside the set, or the card's
    // own id, means "no parent".
    const parent = new Map<number, number>();
    for (const [child, p] of input.parentOf) {
        if (known.has(child) && known.has(p) && child !== p) parent.set(child, p);
    }
    const attachedTo = (id: number): number | null => {
        if (parent.has(id)) return parent.get(id) ?? null;
        if (!input.ghostIds.has(id)) return null;
        // A ghost goes in the group of the lowest-id real card it connects to.
        const neighbours = input.dependencies
            .flatMap((d) => (d.blocker === id ? [d.blocked] : d.blocked === id ? [d.blocker] : []))
            .filter((n) => known.has(n) && !input.ghostIds.has(n))
            .sort((a, b) => a - b);
        if (neighbours.length === 0) return null;
        return parent.get(neighbours[0]) ?? neighbours[0];
    };
    const children = new Map<number, number[]>();
    const topLevel: number[] = [];
    for (const id of ids) {
        const at = attachedTo(id);
        if (at == null || at === id) topLevel.push(id);
        else children.set(at, [...(children.get(at) ?? []), id]);
    }

    const visited = new Set<number>();
    const columnX = (id: number) => (column.get(id) ?? 0) * COL_STEP;

    const layoutGroup = (memberIds: number[]): Block | null => {
        const blocks: Array<{ block: Block; key: number }> = [];
        for (const id of memberIds) {
            const block = layoutNode(id);
            // The root sorts before everything else, whatever its id.
            if (block) blocks.push({ block, key: id === input.rootId ? -Infinity : id });
        }
        if (blocks.length === 0) return null;
        const connected = blocks
            .filter((b) => b.block.connected)
            .sort((a, b) => a.block.minX - b.block.minX || a.key - b.key);
        const free = blocks.filter((b) => !b.block.connected).sort((a, b) => a.key - b.key);
        const candidates = connected.map((b) => b.block);
        if (free.length > 0) {
            const base = connected.length > 0 ? connected[0].block.minX : 0;
            candidates.push(
                shelfPack(
                    free.map((b) => b.block),
                    base
                )
            );
        }
        // Rows of blocks: the first row where its columns are free.
        const lanes: Block[][] = [];
        const laneOf: number[] = [];
        for (const block of candidates) {
            let lane = lanes.findIndex((row) =>
                row.every((o) => block.minX >= o.maxX + COL_GAP || block.maxX + COL_GAP <= o.minX)
            );
            if (lane === -1) {
                lanes.push([]);
                lane = lanes.length - 1;
            }
            lanes[lane].push(block);
            laneOf.push(lane);
        }
        const laneTop: number[] = [];
        let top = 0;
        lanes.forEach((row, i) => {
            laneTop[i] = top;
            top += Math.max(...row.map((b) => b.height)) + LANE_GAP;
        });
        const placed = candidates.map((b, i) => shift(b, 0, laneTop[laneOf[i]]));
        return merge(placed, top - LANE_GAP);
    };

    const layoutNode = (id: number): Block | null => {
        if (visited.has(id)) return null;
        visited.add(id);
        const kids = children.get(id) ?? [];
        const group = kids.length > 0 ? layoutGroup(kids) : null;
        const own = hasDependency.has(id);
        if (!group) {
            // A card on its own: at its column if it has dependencies, else x = 0 and
            // the group wraps it with the other unrelated cards.
            const x = own ? columnX(id) : 0;
            return {
                items: [{ id, x, y: 0 }],
                tops: [[x, x + NODE_WIDTH]],
                minX: x,
                maxX: x + NODE_WIDTH,
                height: NODE_HEIGHT,
                connected: own,
            };
        }
        const lo = Math.min(...group.tops.map((t) => t[0]));
        const hi = Math.max(...group.tops.map((t) => t[1]));
        const x = (lo + hi) / 2 - NODE_WIDTH / 2;
        const below = shift(group, 0, NODE_HEIGHT + RANK_GAP);
        return {
            items: [{ id, x, y: 0 }, ...below.items],
            tops: [[x, x + NODE_WIDTH]],
            minX: Math.min(x, below.minX),
            maxX: Math.max(x + NODE_WIDTH, below.maxX),
            height: NODE_HEIGHT + RANK_GAP + group.height,
            connected: group.connected || own,
        };
    };

    const roots = layoutGroup(topLevel);
    // Cards only reachable through a parent loop never got a turn: give each one.
    const leftovers = ids.filter((id) => !visited.has(id));
    const extra = leftovers.length > 0 ? layoutGroup(leftovers) : null;

    const result = new Map<number, Position>();
    const place = (block: Block | null, dy: number) => {
        if (!block) return;
        for (const item of block.items) {
            result.set(item.id, { x: item.x + MARGIN, y: item.y + dy + MARGIN });
        }
    };
    place(roots, 0);
    place(extra, roots ? roots.height + LANE_GAP : 0);
    return result;
};

/**
 * React Flow adapter: positions for the nodes `buildNodesAndEdges` produced. Same
 * contract as the dagre hook it replaces (returns the nodes with `position`,
 * `width` and `height` set, so React Flow needn't measure before first paint).
 */
export const layoutDiagramNodes = (nodes: Node[], edges: Edge[]): Node[] => {
    if (nodes.length === 0) return nodes;

    const parentOf = new Map<number, number>();
    const dependencies: Array<{ blocker: number; blocked: number }> = [];
    for (const edge of edges) {
        const kind = (edge.data as { kind?: string } | undefined)?.kind;
        if (kind === "structure") parentOf.set(Number(edge.target), Number(edge.source));
        else if (kind === "dependency") {
            dependencies.push({ blocker: Number(edge.source), blocked: Number(edge.target) });
        }
    }
    const ghostIds = new Set<number>();
    let rootId: number | null = null;
    for (const node of nodes) {
        const data = node.data as { isExternal?: boolean; isRoot?: boolean };
        if (data.isExternal) ghostIds.add(Number(node.id));
        if (data.isRoot && !data.isExternal) rootId = Number(node.id);
    }

    const positions = computeDiagramLayout({
        nodeIds: nodes.map((n) => Number(n.id)),
        rootId,
        parentOf,
        dependencies,
        ghostIds,
    });

    return nodes.map((node) => {
        const at = positions.get(Number(node.id)) ?? { x: MARGIN, y: MARGIN };
        return { ...node, position: at, width: NODE_WIDTH, height: NODE_HEIGHT } as Node;
    });
};
// CI demo, not for merge
