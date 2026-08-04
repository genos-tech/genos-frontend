import { useCallback, useMemo, useState } from "react";
import { NavigateFunction } from "react-router-dom";

import { ModalTarget, parseInternalUrl } from "../../utils/parseInternalUrl";

// Modal targets that are wired up today. Anything not in this set falls
// back to react-router navigation so partially-implemented phases still
// behave sensibly — the parser already recognises future kinds (task,
// myNote, etc.) so adding a kind to the modal is a one-line change here
// once the view exists.
const SUPPORTED_KINDS: ReadonlySet<ModalTarget["kind"]> = new Set([
    "chatMain",
    "chatNote",
    "chatThread",
    "milestone",
    "myNote",
    "sharedNote",
    "task",
    "taskNote",
    "todo",
]);

export type OpenModalByHrefOptions = {
    // "Leave the preview, open the real page" action for this target.
    // When supplied, UrlLinkModal shows a Move-to-page button beside its
    // ✕. It's per-open rather than derived here because only the OPENER
    // knows how to land correctly: `ModalTarget` keeps the parsed ids but
    // drops the href, and several kinds need more than a bare navigate
    // (a chat the user hasn't opened this session needs
    // `moveToSpecificChat`, or the chat surface renders blank).
    onOpenFullPage?: () => void;
    // Override the modal's stacking context. Default (omitted) uses
    // UrlLinkModal's own default (10020), correct for the chat-message
    // link case. Callers that open the preview from a higher surface
    // (e.g. the Spotlight overlay at z=13100) pass a value above it.
    zIndex?: number;
};

export type UrlLinkModalState = {
    target: ModalTarget | null;
    zIndex: number | undefined;
    /** Present only while the open preview was given an
     *  `onOpenFullPage`. Closes the modal before running it — the
     *  navigation would otherwise happen BEHIND the still-open dialog. */
    openFullPage: (() => void) | null;
    openModalByHref: (
        href: string,
        opts?: OpenModalByHrefOptions
    ) => "opened" | "navigated" | "external";
    closeModal: () => void;
};

type UseUrlLinkModalStateProps = {
    navigate: NavigateFunction;
};

export const useUrlLinkModalState = ({
    navigate,
}: UseUrlLinkModalStateProps): UrlLinkModalState => {
    const [target, setTarget] = useState<ModalTarget | null>(null);
    const [zIndex, setZIndex] = useState<number | undefined>(undefined);
    // Wrapped in an object because `useState` treats a bare function
    // argument as an updater.
    const [fullPage, setFullPage] = useState<{ run: () => void } | null>(null);

    const closeModal = useCallback(() => {
        setTarget(null);
        setZIndex(undefined);
        setFullPage(null);
    }, []);

    const openModalByHref = useCallback(
        (href: string, opts?: OpenModalByHrefOptions): "opened" | "navigated" | "external" => {
            const classified = parseInternalUrl(href);

            if (classified.kind === "external") {
                window.open(href, "_blank", "noopener,noreferrer");
                return "external";
            }

            if (classified.kind === "route") {
                navigate(classified.pathname + classified.search);
                // A route link clicked while the modal is open would
                // otherwise navigate the page BEHIND the still-open
                // dialog — the user sees "nothing happened". Close so
                // the navigation is visible.
                closeModal();
                return "navigated";
            }

            if (SUPPORTED_KINDS.has(classified.kind)) {
                // Preserve the current stacking when an already-open
                // modal re-targets itself (a link clicked INSIDE the
                // modal) and the caller didn't pass an explicit level.
                // Without this, a preview opened from a high surface
                // (Spotlight at 13200, or above a task diagram) would
                // drop back to the 10020 default mid-flow and vanish
                // behind its opener.
                setZIndex(opts?.zIndex ?? (target !== null ? zIndex : undefined));
                // NOT preserved across a re-target, unlike the stacking
                // above: a link followed from inside the modal puts a
                // different entity on screen, and the previous action
                // would send the user to the one they navigated away
                // from. No action ⇒ no button, which is right.
                setFullPage(opts?.onOpenFullPage ? { run: opts.onOpenFullPage } : null);
                setTarget(classified);
                return "opened";
            }

            // Known modal kind, not yet implemented in this phase. Fall
            // back to react-router so the user lands on the real page
            // (and close for the same behind-the-dialog reason as above).
            navigate(href);
            closeModal();
            return "navigated";
        },
        [navigate, closeModal, target, zIndex]
    );

    const openFullPage = useMemo(
        () =>
            fullPage === null
                ? null
                : () => {
                      closeModal();
                      fullPage.run();
                  },
        [fullPage, closeModal]
    );

    return { closeModal, openFullPage, openModalByHref, target, zIndex };
};
