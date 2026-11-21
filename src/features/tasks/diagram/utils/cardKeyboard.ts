/**
 * MIP-1830 (decision note task:219, option A): where an arrow key takes focus on the
 * task graph. A card is one Tab stop; an arrow moves focus to the card linked to it by a
 * dependency or a parent that lies in the arrow's direction. Cards never move from the
 * keyboard (mouse and touch dragging are unchanged).
 */

export type CardArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export type CardGeometry = { id: string; x: number; y: number; width: number; height: number };

/** A dependency or a parent-child line, by card id. Direction does not matter here. */
export type CardLink = { source: string; target: string };

export const isCardArrowKey = (key: string): key is CardArrowKey =>
    key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight";

/**
 * The linked card an arrow moves focus to, or null. "In the direction" means strictly
 * past the card's centre on that axis; among those, the nearest wins, with sideways
 * offset counted double so a card straight ahead beats a diagonal one. Ties go to the
 * lower id, so the answer is stable.
 */
export const linkedCardInDirection = (
    fromId: string,
    key: CardArrowKey,
    cards: readonly CardGeometry[],
    links: readonly CardLink[]
): string | null => {
    const byId = new Map(cards.map((c) => [c.id, c]));
    const from = byId.get(fromId);
    if (!from) return null;
    const linked = new Set<string>();
    for (const link of links) {
        if (link.source === fromId) linked.add(link.target);
        else if (link.target === fromId) linked.add(link.source);
    }
    const cx = (c: CardGeometry) => c.x + c.width / 2;
    const cy = (c: CardGeometry) => c.y + c.height / 2;
    const fx = cx(from);
    const fy = cy(from);

    let best: { id: string; score: number } | null = null;
    for (const id of linked) {
        const c = byId.get(id);
        if (!c) continue;
        const dx = cx(c) - fx;
        const dy = cy(c) - fy;
        let along: number;
        let across: number;
        switch (key) {
            case "ArrowDown":
                along = dy;
                across = dx;
                break;
            case "ArrowUp":
                along = -dy;
                across = dx;
                break;
            case "ArrowRight":
                along = dx;
                across = dy;
                break;
            case "ArrowLeft":
                along = -dx;
                across = dy;
                break;
        }
        if (along <= 0) continue;
        const score = along + 2 * Math.abs(across);
        if (!best || score < best.score || (score === best.score && id < best.id)) {
            best = { id, score };
        }
    }
    return best?.id ?? null;
};

/** A React Flow node as the arrow rule reads it: where it is and how big it was measured. */
export const cardGeometryOf = (n: {
    id: string;
    position: { x: number; y: number };
    measured?: { width?: number; height?: number };
    width?: number | null;
    height?: number | null;
}): CardGeometry => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    width: n.measured?.width ?? n.width ?? 0,
    height: n.measured?.height ?? n.height ?? 0,
});
