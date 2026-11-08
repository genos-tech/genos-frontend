import { useEffect, useRef } from "react";

import { isEditableTarget, matchesShortcut, SHORTCUTS, type ShortcutId } from "./registry";

type Options = {
    /** Attach to `window` instead of `document` (the create-task form always did). */
    target?: "document" | "window";
    /** Listen only while true. Defaults to true. */
    enabled?: boolean;
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
    { target = "document", enabled = true }: Options = {}
): void => {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        if (!enabled) return undefined;
        const host: Document | Window = target === "window" ? window : document;
        const onKeyDown = (event: Event) => {
            const e = event as KeyboardEvent;
            if (!matchesShortcut(id, e)) return;
            if (SHORTCUTS[id].editable === "skip" && isEditableTarget(e.target)) return;
            handlerRef.current(e);
        };
        host.addEventListener("keydown", onKeyDown);
        return () => host.removeEventListener("keydown", onKeyDown);
    }, [id, target, enabled]);
};
