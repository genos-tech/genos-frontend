import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

/**
 * The open/closed state of the notes sidebar's filter results (MIP-1435).
 *
 * The words stay in the field, so "closed" means the list of results gives way to the tree and
 * the field is still filled. Typing, a click on the field, ArrowDown and "/" open it again.
 * It closes when:
 *   - a result is opened (`onOpened`);
 *   - the pointer goes down anywhere outside the field and the results (a tree row, the editor,
 *     another page area; capture phase, so a click that something stops still counts);
 *   - the words are cleared: Escape in the field (see `NoteSearchBar`), or Escape on a result,
 *     which also puts the focus back in the field instead of dropping it on the page.
 *
 * Only the field and the results count as "inside", and the results hold no portaled menu (a
 * result's star is a plain button), so a DOM `contains` check is enough.
 */
export const useNoteFilter = () => {
    const [query, setQueryState] = useState("");
    const [open, setOpen] = useState(true);
    const barRef = useRef<HTMLDivElement | null>(null);
    const resultsRef = useRef<HTMLUListElement | null>(null);

    const active = query.trim().length > 0;
    const visible = active && open;

    const setQuery = useCallback((value: string) => {
        setQueryState(value);
        setOpen(true);
    }, []);
    const reopen = useCallback(() => setOpen(true), []);

    const focusField = useCallback(() => {
        barRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    }, []);

    useEffect(() => {
        if (!visible) return;
        const onPointerDown = (event: Event) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (barRef.current?.contains(target) || resultsRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        return () => document.removeEventListener("pointerdown", onPointerDown, true);
    }, [visible]);

    /**
     * A result was opened. `viaKeyboard` (Enter on the row: its click has `detail` 0): the row
     * the focus was on is about to go, so the focus goes back to the field and not to the page.
     */
    const onOpened = useCallback(
        (viaKeyboard: boolean) => {
            setOpen(false);
            if (viaKeyboard) focusField();
        },
        [focusField]
    );

    const onResultsKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            setQuery("");
            focusField();
        },
        [focusField, setQuery]
    );

    return {
        query,
        setQuery,
        active,
        visible,
        reopen,
        barRef,
        resultsRef,
        onOpened,
        onResultsKeyDown,
    };
};
