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
    "myNote",
    "sharedNote",
    "task",
    "taskNote",
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
                return "navigated";
            }

            if (SUPPORTED_KINDS.has(classified.kind)) {
                setZIndex(opts?.zIndex);
                setTarget(classified);
                return "opened";
            }

            // Known modal kind, not yet implemented in this phase. Fall
            // back to react-router so the user lands on the real page.
            navigate(href);
            return "navigated";
        },
        [navigate]
    );

    return { closeModal, openModalByHref, target, zIndex };
};
