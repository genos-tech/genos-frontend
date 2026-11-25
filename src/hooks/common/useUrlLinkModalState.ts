import { useCallback, useEffect, useMemo, useState } from "react";
import { NavigateFunction } from "react-router-dom";

import { captureNoteTargetFromHref } from "../../features/notes/common/utils/noteTarget";
import { closeModalPages, pushModalPage, subscribeModalHistory } from "../../utils/modalHistory";
import { ModalTarget, parseInternalUrl } from "../../utils/parseInternalUrl";

// The owner name of the preview's browser-history entries (MIP-2376).
const HISTORY_OWNER = "url-link-modal";

type LinkPage = {
    target: ModalTarget;
    zIndex: number | undefined;
    fullPage: { run: () => void } | null;
};

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
    // The same action for the common case: "the real page IS this href".
    // Saves a caller that has nothing else to do from reaching for a
    // `navigate` of its own — this hook already owns one — which for deep
    // consumers (an inbox card, a chat preview) means not needing to sit
    // inside a router at all. Ignored when `onOpenFullPage` is given.
    fullPageHref?: string;
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
    /** Opens the to-do modal on the WHOLE list (MIP-1044) — there is no href
     *  for it, so it is opened by target rather than parsed from a link. */
    openTodoList: (opts?: Pick<OpenModalByHrefOptions, "onOpenFullPage" | "zIndex">) => void;
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

    const reset = useCallback(() => {
        setTarget(null);
        setZIndex(undefined);
        setFullPage(null);
    }, []);

    // Back / Forward (MIP-2376): the browser moved to another page of this modal, or out of it.
    useEffect(
        () =>
            subscribeModalHistory(HISTORY_OWNER, (value) => {
                const page = value as LinkPage | null;
                if (!page) {
                    reset();
                    return;
                }
                setTarget(page.target);
                setZIndex(page.zIndex);
                setFullPage(page.fullPage);
            }),
        [reset]
    );

    // Closes at once and removes the modal's history entries; `then` runs after the browser has
    // finished going back, so a navigation that follows is not undone by it.
    const closeThen = useCallback(
        (then?: () => void) => {
            reset();
            closeModalPages(HISTORY_OWNER, then);
        },
        [reset]
    );
    const closeModal = useCallback(() => closeThen(), [closeThen]);

    const openPage = useCallback((page: LinkPage) => {
        setZIndex(page.zIndex);
        setFullPage(page.fullPage);
        setTarget(page.target);
        pushModalPage(HISTORY_OWNER, page);
    }, []);

    const openModalByHref = useCallback(
        (href: string, opts?: OpenModalByHrefOptions): "opened" | "navigated" | "external" => {
            const classified = parseInternalUrl(href);

            if (classified.kind === "external") {
                window.open(href, "_blank", "noopener,noreferrer");
                return "external";
            }

            if (classified.kind === "route") {
                // A route link clicked while the modal is open would
                // otherwise navigate the page BEHIND the still-open
                // dialog — the user sees "nothing happened". Close so
                // the navigation is visible; it runs once the modal's
                // history entries are gone, so it is not undone by them.
                closeThen(() => navigate(classified.pathname + classified.search));
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
                const nextZIndex = opts?.zIndex ?? (target !== null ? zIndex : undefined);
                // NOT preserved across a re-target, unlike the stacking
                // above: a link followed from inside the modal puts a
                // different entity on screen, and the previous action
                // would send the user to the one they navigated away
                // from. No action ⇒ no button, which is right.
                const fullPageHref = opts?.fullPageHref;
                const fullPageAction = opts?.onOpenFullPage
                    ? { run: opts.onOpenFullPage }
                    : fullPageHref
                      ? { run: () => navigate(fullPageHref) }
                      : null;
                // A note link that names a block or a comment (MIP-146): the editor in the
                // preview acts on it once the note is up.
                captureNoteTargetFromHref(href);
                if (target && JSON.stringify(target) === JSON.stringify(classified)) {
                    // The link to what is already open adds no history entry.
                    setZIndex(nextZIndex);
                    setFullPage(fullPageAction);
                } else {
                    openPage({ target: classified, zIndex: nextZIndex, fullPage: fullPageAction });
                }
                return "opened";
            }

            // Known modal kind, not yet implemented in this phase. Fall
            // back to react-router so the user lands on the real page
            // (and close for the same behind-the-dialog reason as above).
            closeThen(() => navigate(href));
            return "navigated";
        },
        [navigate, closeThen, openPage, target, zIndex]
    );

    const openTodoList = useCallback(
        (opts?: Pick<OpenModalByHrefOptions, "onOpenFullPage" | "zIndex">) => {
            openPage({
                target: { kind: "todo" },
                zIndex: opts?.zIndex,
                fullPage: opts?.onOpenFullPage ? { run: opts.onOpenFullPage } : null,
            });
        },
        [openPage]
    );

    const openFullPage = useMemo(
        () => (fullPage === null ? null : () => closeThen(fullPage.run)),
        [fullPage, closeThen]
    );

    return { closeModal, openFullPage, openModalByHref, openTodoList, target, zIndex };
};
