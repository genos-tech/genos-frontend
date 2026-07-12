import { useCallback, useState } from "react";
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
    // Override the modal's stacking context. Default (omitted) uses
    // UrlLinkModal's own default (10020), correct for the chat-message
    // link case. Callers that open the preview from a higher surface
    // (e.g. the Spotlight overlay at z=13100) pass a value above it.
    zIndex?: number;
};

export type UrlLinkModalState = {
    target: ModalTarget | null;
    zIndex: number | undefined;
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

    const closeModal = useCallback(() => {
        setTarget(null);
        setZIndex(undefined);
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

    return { closeModal, openModalByHref, target, zIndex };
};
