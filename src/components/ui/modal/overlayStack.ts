// Which full-screen overlay is on top, so the ones under it can stop blurring (MIP-2556).
//
// A `backdrop-filter` is computed again on every frame that is drawn, also when all that moved is
// the dialog ABOVE it. Two blurred layers stacked (a preview over Spotlight, a preview over the
// task diagram) therefore made scrolling the top one cost a second full-screen blur per frame. The
// top layer's blur already covers everything below, so a covered layer drops its own.
//
// Joy modals and the Spotlight overlay are siblings in different parts of the DOM and are ordered by
// z-index, not by DOM order, which a CSS selector cannot read: hence this small registry.

import { useCallback, useLayoutEffect, useState, useSyncExternalStore } from "react";

type Layer = { id: object; zIndex: number };

// Open overlays, in the order they opened.
let layers: Layer[] = [];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

// A higher z-index covers; at the same z-index the one opened later does.
const isCovered = (id: object): boolean => {
    const at = layers.findIndex((layer) => layer.id === id);
    if (at < 0) return false;
    const { zIndex } = layers[at];
    return layers.some(
        (layer, index) => layer.zIndex > zIndex || (layer.zIndex === zIndex && index > at)
    );
};

/** Registers an overlay that dims the whole screen while `open`, and says whether another one is
 *  above it. */
export const useCoveredOverlay = (open: boolean, zIndex: number): boolean => {
    const [id] = useState(() => ({}));

    useLayoutEffect(() => {
        if (!open) return;
        layers = [...layers, { id, zIndex }];
        emit();
        return () => {
            layers = layers.filter((layer) => layer.id !== id);
            emit();
        };
    }, [id, open, zIndex]);

    return useSyncExternalStore(
        subscribe,
        useCallback(() => isCovered(id), [id])
    );
};
