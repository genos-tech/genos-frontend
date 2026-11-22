import { ReactNode, useEffect, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/joy";

import { focusRing } from "../../../theme/tokens";
import { visuallyHidden } from "../a11y/visuallyHidden";
import { EmptyState } from "../feedback/EmptyState";

/**
 * A short list that pages on demand: the rows it has, then a "Load more" button (MIP-2024).
 * Shared by Settings → AI credit usage (Recent charges) and Settings → Developer (Security log), so
 * the two lists behave the same.
 *
 * The parent owns the data and the fetch; this owns what a reader and a keyboard need:
 *  - a real `<button>`, not a link or a div;
 *  - after a page arrives, focus moves to the FIRST NEW row (rows take `tabIndex={-1}`), so a
 *    keyboard or screen-reader user continues where the new rows start instead of at the top;
 *  - a polite live region says how many rows are shown (`shownLabel`) and, at the end, that
 *    there are no more (`endLabel`);
 *  - the empty state, the failed state (`failed`: the rows already shown stay, the button turns
 *    into "retry" and the error is announced) and the end state are all explicit.
 */

interface Props<T> {
    items: T[];
    getKey: (item: T) => string | number;
    renderItem: (item: T) => ReactNode;
    hasMore: boolean;
    loading: boolean;
    failed?: boolean;
    onLoadMore: () => void;
    /** Button label. */
    loadMoreLabel: string;
    /** Button label after a failed page (defaults to `loadMoreLabel`). */
    retryLabel?: string;
    /** Spoken after a page arrives: "Showing 10 charges". Gets the count of rows now shown. */
    shownLabel: (count: number) => string;
    /** Shown under the list, and announced, when there is nothing more to load. */
    endLabel?: string;
    /** Shown when a page failed (the rows already shown stay). */
    failedLabel?: string;
    /** Shown instead of the list when there are no rows at all. */
    emptyLabel: string;
    /** Accessible name of the list. */
    ariaLabel: string;
    /** The row elements' look: the `<li>` wrapper. */
    itemSx?: object;
    listSx?: object;
    /** Padding of the button and the end line, to line them up with the rows. */
    footerSx?: object;
}

export function LoadMoreList<T>({
    items,
    getKey,
    renderItem,
    hasMore,
    loading,
    failed = false,
    onLoadMore,
    loadMoreLabel,
    retryLabel,
    shownLabel,
    endLabel,
    failedLabel,
    emptyLabel,
    ariaLabel,
    itemSx,
    listSx,
    footerSx,
}: Props<T>) {
    const listRef = useRef<HTMLUListElement | null>(null);
    // How many rows were shown when the person asked for more: the first new row is that index.
    const askedAtRef = useRef<number | null>(null);
    // Nothing is announced until the person asks for more: the first render does not speak.
    const [status, setStatus] = useState("");
    const asked = useRef(false);

    useEffect(() => {
        const at = askedAtRef.current;
        if (!asked.current) return;
        if (failed) return; // the visible error below is a role="alert"
        if (at === null || items.length <= at) return;
        askedAtRef.current = null;
        const row = listRef.current?.children[at] as HTMLElement | undefined;
        row?.focus();
        setStatus(hasMore ? shownLabel(items.length) : (endLabel ?? shownLabel(items.length)));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- a new page is what triggers it
    }, [items.length, failed]);

    if (items.length === 0 && !loading && !failed) {
        return <EmptyState body={emptyLabel} size="xs" />;
    }

    return (
        <Box>
            <Box
                ref={listRef}
                aria-label={ariaLabel}
                component="ul"
                sx={{ listStyle: "none", m: 0, p: 0, ...listSx }}
            >
                {items.map((item) => (
                    <Box
                        key={getKey(item)}
                        component="li"
                        // Focusable by script only: the target of "focus the first new row".
                        tabIndex={-1}
                        sx={{
                            outline: "none",
                            "&:focus-visible": { ...focusRing, outlineOffset: "-2px" },
                            ...itemSx,
                        }}
                    >
                        {renderItem(item)}
                    </Box>
                ))}
            </Box>
            <Box aria-live="polite" role="status" sx={visuallyHidden}>
                {status}
            </Box>
            {failed && failedLabel && (
                <Typography
                    color="danger"
                    level="body-xs"
                    role="alert"
                    sx={{ mt: 1, ...footerSx }}
                >
                    {failedLabel}
                </Typography>
            )}
            {hasMore ? (
                <Button
                    loading={loading}
                    size="sm"
                    sx={{ mt: 1, alignSelf: "flex-start", ...footerSx }}
                    variant="plain"
                    onClick={() => {
                        asked.current = true;
                        askedAtRef.current = items.length;
                        setStatus("");
                        onLoadMore();
                    }}
                >
                    {failed ? (retryLabel ?? loadMoreLabel) : loadMoreLabel}
                </Button>
            ) : (
                endLabel &&
                items.length > 0 && (
                    <Typography level="body-xs" sx={{ mt: 1, opacity: 0.7, ...footerSx }}>
                        {endLabel}
                    </Typography>
                )
            )}
        </Box>
    );
}
