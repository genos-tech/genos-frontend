import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

/**
 * The open/closed state of the notes sidebar's filter results (MIP-1435).
 *
 * The words stay in the field, so "closed" means the list of results gives way to the tree and
 * the field is still filled. Typing, a click on the field, ArrowDown and "/" open it again.
 * It closes when:
 *   - a result is opened (`onOpened`);
 *   - a click or a tap lands anywhere outside the field and the results (the editor, a tab,
 *     the blank area under the list; capture phase, so a click that something stops still
 *     counts). It is the click and not the pointer going DOWN on purpose: closing swaps the
 *     results for the families, and on a phone the click that finishes the same tap would then
 *     land on whatever row appeared under the finger and open it;
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
        const onClick = (event: Event) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (barRef.current?.contains(target) || resultsRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
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
