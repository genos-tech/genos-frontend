import { NotificationsContext, NotificationsProviderProps } from "./notificationsContextState";

export const NotificationsProvider = ({ value, children }: NotificationsProviderProps) => (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
);
