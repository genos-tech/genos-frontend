import { createContext, ReactNode, useContext } from "react";

import { NotificationsState } from "../../hooks/common/useNotifications";

const NotificationsContext = createContext<NotificationsState | null>(null);

interface NotificationsProviderProps {
    value: NotificationsState;
    children: ReactNode;
}

export const NotificationsProvider = ({ value, children }: NotificationsProviderProps) => (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
);

/**
 * Returns the active notification state. Consumers must be rendered inside
 * `<NotificationsProvider>`. Returns `null` if used outside the provider so
 * components can degrade gracefully (e.g. mute buttons can hide themselves).
 */
export const useNotificationsContext = (): NotificationsState | null =>
    useContext(NotificationsContext);
