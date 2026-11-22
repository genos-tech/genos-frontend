import { createContext, ReactNode, useContext } from "react";

import { NotificationsState } from "../../hooks/common/useNotifications";

export const NotificationsContext = createContext<NotificationsState | null>(null);

export interface NotificationsProviderProps {
    value: NotificationsState;
    children: ReactNode;
}

/**
 * Returns the active notification state. Consumers must be rendered inside
 * `<NotificationsProvider>`. Returns `null` if used outside the provider so
 * components can degrade gracefully (e.g. mute buttons can hide themselves).
 */
export const useNotificationsContext = (): NotificationsState | null =>
    useContext(NotificationsContext);
