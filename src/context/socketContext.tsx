import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

import { useAuth } from "./AuthContext";

const ws_url = import.meta.env.VITE_WS_BASE_URL;

// Define a context type
interface SocketContextType {
    socket: Socket | null;
}

// Create context
const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Create provider
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { accessToken } = useAuth();
    // Promoted from `useRef` to `useState` so that the provider re-renders
    // and its `value` updates after the socket is actually created in the
    // effect — previously consumers could be stranded with the initial
    // `null` until something else triggered them to re-render.
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const next = io(ws_url, {
            withCredentials: true,
            extraHeaders: { Authorization: accessToken || "" },
        });
        setSocket(next);

        return () => {
            next.disconnect();
            setSocket(null);
        };
    }, [accessToken]);

    // Memoize so unrelated parent re-renders don't churn consumers.
    const value = useMemo(() => ({ socket }), [socket]);

    return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

// Custom hook to use socket
export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error("useSocket must be used within a SocketProvider");
    }
    return context;
};

/**
 * The socket if a provider is above us, `null` if not.
 *
 * For best-effort uses — a live relay that saves the other side a reload —
 * where the component's job does not depend on the socket existing. Those
 * should not throw, and should not force every test that renders them to
 * mount the provider.
 */
export const useOptionalSocket = (): Socket | null => useContext(SocketContext)?.socket ?? null;
