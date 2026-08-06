import { createContext, ReactNode, useContext } from "react";

// Minimal context exposed to deep consumers (BnChatPreview) so they can
// open the URL-link modal without prop-drilling through MessageBubble /
// ThreadMessageBubble / TaskCommentBubble / InboxBubble.
//
// `opts` mirrors the subset of `OpenModalByHrefOptions` these consumers
// can use: `zIndex` for callers layered above the modal's 10020 default
// (e.g. the task diagram opening a node preview from a modal-hosted
// graph), and `fullPageHref` to offer the preview's Move-to-page button
// without needing a `navigate` — which these consumers can't assume,
// since some of them render outside a router.
type UrlLinkModalContextValue = {
    openModalByHref: (
        href: string,
        opts?: { zIndex?: number; fullPageHref?: string }
    ) => "opened" | "navigated" | "external";
};

const UrlLinkModalContext = createContext<UrlLinkModalContextValue | null>(null);

export const UrlLinkModalProvider = ({
    value,
    children,
}: {
    value: UrlLinkModalContextValue;
    children: ReactNode;
}) => <UrlLinkModalContext.Provider value={value}>{children}</UrlLinkModalContext.Provider>;

// Returns null when used outside the provider (e.g. signin pages) so
// callers can no-op gracefully rather than throwing.
// eslint-disable-next-line react-refresh/only-export-components
export const useUrlLinkModal = (): UrlLinkModalContextValue | null => {
    return useContext(UrlLinkModalContext);
};
