import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Render a long list in chunks, as far down as the user has scrolled (MIP-1985).
 *
 * A board column with ~570 Closed cards drew all of them on open (21,000 DOM nodes). Up to
 * RENDER_ALL_UP_TO cards the column renders exactly as before. Longer lists render the first
 * RENDER_STEP cards and add a chunk whenever the scroller comes within RENDER_AHEAD_PX of its
 * end. The rendered cards are always a PREFIX of the list, so the drag library's indexes,
 * the card order and the drop positions stay the list's own.
 */
export const RENDER_ALL_UP_TO = 60;
export const RENDER_STEP = 40;
export const RENDER_AHEAD_PX = 600;

/** How many of `total` items to render when `chunks` extra chunks have been asked for. */
export const renderLimit = (total: number, chunks: number): number =>
    total <= RENDER_ALL_UP_TO ? total : Math.min(total, RENDER_STEP * (1 + chunks));

/** True when the scroller is close enough to its end that the next chunk should be drawn. */
export const nearEnd = (el: {
    scrollTop: number;
    clientHeight: number;
    scrollHeight: number;
}): boolean => el.scrollHeight - (el.scrollTop + el.clientHeight) <= RENDER_AHEAD_PX;

type Grow = (mode: "chunk" | "all") => void;

export const useRenderOnScroll = (total: number) => {
    const [chunks, setChunks] = useState(0);
    const limit = renderLimit(total, chunks);
    const scroller = useRef<HTMLElement | null>(null);

    const grow: Grow = useCallback(
        (mode) =>
            setChunks((c) => (mode === "all" ? Number.MAX_SAFE_INTEGER / RENDER_STEP : c + 1)),
        []
    );

    // A chunk may not fill the scroller (a tall viewport, short cards): keep adding until
    // it does, or until the list is all drawn.
    useLayoutEffect(() => {
        const el = scroller.current;
        if (limit >= total || !el) return;
        if (nearEnd(el)) grow("chunk");
    }, [limit, total, grow]);

    const onScroll = useCallback(
        (event: React.UIEvent<HTMLElement>) => {
            if (limit < total && nearEnd(event.currentTarget)) grow("chunk");
        },
        [limit, total, grow]
    );

    return { limit, grow, onScroll, scroller };
};
