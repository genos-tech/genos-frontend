import { useEffect, useRef, type RefObject } from "react";

import {
    editablePolicy,
    isEditableTarget,
    matchesShortcut,
    SHORTCUTS,
    type ShortcutId,
} from "./registry";

/** Inside `scope`, or nowhere in particular (focus on `body`, a non-node target)? */
const isInsideOrIdle = (scope: HTMLElement | null, target: EventTarget | null): boolean => {
    if (!(target instanceof Node)) return true;
    if (target === document.body || target === document.documentElement) return true;
    return !!scope && scope.contains(target);
};

type Options = {
    /** Attach to `window` instead of `document` (the create-task form always did). */
    target?: "document" | "window";
    /** Listen only while true. Defaults to true. */
    enabled?: boolean;
    /**
     * A form shortcut, not a global one: fire only when the key was pressed
     * inside this element, or with nothing focused (`body`, or a synthetic
     * event on `window`). Cmd/Ctrl+Enter in the chat composer must send the
     * message, not also submit an open create-task panel beside it (MIP-1312).
     */
    within?: RefObject<HTMLElement | null>;
};

/**
 * Run `handler` when shortcut `id` is pressed.
 *
 * One listener, attached once: the handler is read through a ref, so an inline
 * arrow from the caller never re-binds it. The registry decides what matches
 * and whether a key pressed inside a text field is ignored (`editable: "skip"`).
 * The handler is responsible for `preventDefault`, because only it knows
 * whether it consumed the key (Cmd+K always does; a chat-arrow shortcut with no
 * list to move in does not).
 */
export const useShortcut = (
    id: ShortcutId,
    handler: (event: KeyboardEvent) => void,
    { target = "document", enabled = true, within }: Options = {}
): void => {
    const handlerRef = useRef(handler);
    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);

    useEffect(() => {
        if (!enabled) return undefined;
        const host: Document | Window = target === "window" ? window : document;
        // A shortcut that claims its keys from the editor listens before the editor's own
        // listener (capture) and ends the event once handled (MIP-1310).
        const claims = "claimsEditor" in SHORTCUTS[id];
        const onKeyDown = (event: Event) => {
            const e = event as KeyboardEvent;
            if (!matchesShortcut(id, e)) return;
            if (editablePolicy(id) === "skip" && isEditableTarget(e.target)) return;
            if (within && !isInsideOrIdle(within.current, e.target)) return;
            handlerRef.current(e);
            if (claims) e.stopPropagation();
        };
        host.addEventListener("keydown", onKeyDown, claims);
        return () => host.removeEventListener("keydown", onKeyDown, claims);
    }, [id, target, enabled, within]);
};
