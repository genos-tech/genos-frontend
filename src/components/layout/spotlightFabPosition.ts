/**
 * Geometry + persistence for the draggable mobile Spotlight FAB.
 *
 * Pure on purpose (same reasoning as `resolveJumpScroll`): the component
 * owns pointer capture and DOM measurement, which can't be exercised
 * without a browser. The rules that are easy to get wrong — which edge a
 * drop snaps to, and staying on-screen after a rotation or a keyboard
 * open — live here and are unit-tested.
 */

/** Which side edge the button is parked against. */
export type FabSide = "left" | "right";

/**
 * A user-chosen position: a side edge plus a distance from the top of the
 * viewport. Only the vertical axis is free — snapping horizontally keeps
 * the button out of the middle of the content, and means a rotation only
 * has to re-clamp one number.
 */
export type FabPosition = { side: FabSide; top: number };

/** Rendered button size (px). Matches the `width`/`height` in the sx. */
export const FAB_SIZE = 38;

/** Gap kept between the button and the viewport edges (px). */
export const FAB_EDGE_GAP = 16;

/**
 * Attribute a bottom-pinned composer carries so the FAB can keep clear of it.
 * Put it on the box that holds the editor AND its Send button: that whole
 * box is a control (you tap it to type, and Send sits in its corner).
 */
export const FAB_AVOID_ATTR = "data-fab-avoid";

/** Air (px) left between the FAB and the top edge of a composer it sits above. */
export const FAB_AVOID_GAP = 12;

/**
 * Movement (px) below which a pointer sequence counts as a tap, not a
 * drag. Mirrors `useLongPress`'s `moveTolerance` so the two touch
 * gestures agree on what "held still" means.
 */
export const FAB_TAP_TOLERANCE = 8;

type Bounds = {
    /** `window.innerHeight`. */
    viewportHeight: number;
    /**
     * Space reserved at the bottom — the tab bar, or the keyboard when
     * it's up (`--mobile-bottom-inset`). The button must never park
     * underneath either.
     */
    bottomInset: number;
    size?: number;
    gap?: number;
};

/**
 * Largest `top` that still leaves the whole button visible above the
 * bottom inset. `Math.max` with the gap keeps this sane on a viewport so
 * short that nothing fits (a landscape phone with the keyboard up),
 * where the arithmetic would otherwise go negative and pin the button
 * off the top edge.
 */
const maxTop = ({ viewportHeight, bottomInset, size = FAB_SIZE, gap = FAB_EDGE_GAP }: Bounds) =>
    Math.max(gap, viewportHeight - bottomInset - size - gap);

/** Clamp a `top` into the visible band. */
export const clampFabTop = (top: number, bounds: Bounds): number =>
    Math.min(Math.max(top, bounds.gap ?? FAB_EDGE_GAP), maxTop(bounds));

/**
 * Where a released drag parks.
 *
 * `x` / `y` are the button's top-left in viewport coordinates (not the
 * pointer position — the component subtracts the grab offset so the
 * button doesn't jump under the finger).
 *
 * The side is decided by which half of the viewport the button's CENTRE
 * ended up in, so a drag that crosses the midpoint flips edges the way
 * you'd expect.
 */
export const resolveFabDrop = (
    { x, y }: { x: number; y: number },
    bounds: Bounds & { viewportWidth: number }
): FabPosition => {
    const size = bounds.size ?? FAB_SIZE;
    return {
        side: x + size / 2 < bounds.viewportWidth / 2 ? "left" : "right",
        top: clampFabTop(y, bounds),
    };
};

/** Did this pointer sequence stay still enough to be a tap? */
export const isFabTap = (dx: number, dy: number, tolerance = FAB_TAP_TOLERANCE): boolean =>
    Math.sqrt(dx * dx + dy * dy) <= tolerance;

const STORAGE_KEY = "mobile:spotlightFabPosition";

/**
 * Read the parked position, or `null` when the user has never moved the
 * button (which keeps the default bottom-right anchor — expressed in CSS
 * so it tracks `--BottomTabBar-height` on its own).
 *
 * Tolerant of anything in storage: a hand-edited value, a shape from a
 * future version, or a `top` from a taller device. The caller re-clamps
 * against the live viewport, so only the SHAPE has to be validated here.
 */
export const readStoredFabPosition = (): FabPosition | null => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return null;
        const { side, top } = parsed as { side?: unknown; top?: unknown };
        if (side !== "left" && side !== "right") return null;
        if (typeof top !== "number" || !Number.isFinite(top)) return null;
        return { side, top };
    } catch {
        return null;
    }
};

export const writeStoredFabPosition = (position: FabPosition): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    } catch {
        /* private mode / quota — the position just won't survive a reload */
    }
};

export type Box = { left: number; top: number; right: number; bottom: number };

/**
 * How far (px) the FAB has to rise so it never covers a composer, and whether
 * there is no room left to rise (then it hides, rather than sit on Send).
 *
 * `base` is where the FAB would be with no composer around (its default
 * corner, or where the user parked it); `avoid` are the visible composers.
 * Only a composer the FAB would touch (or come within `gap` of) moves it, so a
 * button parked up by the header stays put, and the FAB is never lifted for
 * a composer that is not under it. Lifting past one composer can land on
 * another, so it settles in at most one pass per composer.
 */
export const fabLift = (
    base: Box,
    avoid: readonly Box[],
    { gap = FAB_AVOID_GAP, edge = FAB_EDGE_GAP }: { gap?: number; edge?: number } = {}
): { lift: number; hidden: boolean } => {
    let lift = 0;
    for (let pass = 0; pass <= avoid.length; pass++) {
        const top = base.top - lift;
        const bottom = base.bottom - lift;
        let next = lift;
        for (const a of avoid) {
            const underX = a.left < base.right && a.right > base.left;
            const underY = a.top < bottom + gap && a.bottom > top;
            if (underX && underY) next = Math.max(next, base.bottom - a.top + gap);
        }
        if (next === lift) break;
        lift = next;
    }
    if (base.top - lift < edge) return { lift: 0, hidden: true };
    return { lift, hidden: false };
};
