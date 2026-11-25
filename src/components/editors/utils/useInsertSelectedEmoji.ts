import { useEffect, useRef } from "react";

/**
 * Run `insert` once each time the picker sets a new `selectedEmoji`.
 *
 * The editors re-create `insert` on every render (it closes over the
 * editor), so listing it as an effect dependency would re-insert the emoji
 * on every re-render. Keeping the latest callback in a ref preserves the
 * original timing: the effect fires only when `selectedEmoji` changes.
 */
export function useInsertSelectedEmoji(
    selectedEmoji: string | null,
    insert: (emoji: string) => void
): void {
    const insertRef = useRef(insert);
    useEffect(() => {
        insertRef.current = insert;
    });

    useEffect(() => {
        if (selectedEmoji !== null) {
            insertRef.current(selectedEmoji);
        }
    }, [selectedEmoji]);
}
