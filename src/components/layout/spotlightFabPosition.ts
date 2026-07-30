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
