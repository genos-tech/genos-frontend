import { createContext, ReactNode, useCallback, useContext, useState } from "react";

// Global compact calendar modal: a single instance lives at the App
// root and is opened from a chat header IconButton, a global
// keyboard shortcut (Ctrl+Cmd+C / Ctrl+Alt+C), and possibly future
// entry points without prop-drilling. Mirrors the
// `UrlLinkModalContext` pattern: the App root owns the state via
// `useCalendarModalState()`, passes it into both the keyboard
// shortcut callback and the Provider's `value`, and renders the
// `CalendarModal` component itself elsewhere in the tree.
interface CalendarModalContextValue {
    isOpen: boolean;
    open: () => void;
    close: () => void;
}

const CalendarModalContext = createContext<CalendarModalContextValue | null>(null);

/** State owner — call at the App root. Pass the returned object
 *  into `CalendarModalProvider`'s `value` AND use `open` in the
 *  keyboard-shortcut wiring. */
// eslint-disable-next-line react-refresh/only-export-components
export const useCalendarModalState = (): CalendarModalContextValue => {
    const [isOpen, setIsOpen] = useState(false);
    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    return { isOpen, open, close };
};

export const CalendarModalProvider = ({
    value,
    children,
}: {
    value: CalendarModalContextValue;
    children: ReactNode;
}) => <CalendarModalContext.Provider value={value}>{children}</CalendarModalContext.Provider>;

// Returns null when used outside the provider so signin / signup /
// other pre-auth flows can call `useCalendarModal()?.open()`
// without bringing in the provider just to no-op.
// eslint-disable-next-line react-refresh/only-export-components
export const useCalendarModal = (): CalendarModalContextValue | null =>
    useContext(CalendarModalContext);
