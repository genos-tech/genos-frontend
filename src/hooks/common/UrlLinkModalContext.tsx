import { createContext, ReactNode, useContext } from "react";

// Minimal context exposed to deep consumers (BnChatPreview) so they can
// open the URL-link modal without prop-drilling through MessageBubble /
// ThreadMessageBubble / TaskCommentBubble / InboxBubble.
type UrlLinkModalContextValue = {
    openModalByHref: (href: string) => "opened" | "navigated" | "external";
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
