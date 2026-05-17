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
    "chatThread",
    "task",
]);

export type UrlLinkModalState = {
    target: ModalTarget | null;
    openModalByHref: (href: string) => "opened" | "navigated" | "external";
    closeModal: () => void;
};

type UseUrlLinkModalStateProps = {
    navigate: NavigateFunction;
};

export const useUrlLinkModalState = ({
    navigate,
}: UseUrlLinkModalStateProps): UrlLinkModalState => {
    const [target, setTarget] = useState<ModalTarget | null>(null);

    const closeModal = useCallback(() => setTarget(null), []);

    const openModalByHref = useCallback(
        (href: string): "opened" | "navigated" | "external" => {
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

    return { closeModal, openModalByHref, target };
};
