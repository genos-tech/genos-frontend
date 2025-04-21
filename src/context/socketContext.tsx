import React, { createContext, useContext, useEffect, useRef } from "react";
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
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!socketRef.current) {
            socketRef.current = io(ws_url, {
                withCredentials: true,
                extraHeaders: { Authorization: accessToken || "" },
            });

            console.log("Socket initialized");

            return () => {
                socketRef.current?.disconnect();
                socketRef.current = null;
            };
        }
    }, [accessToken]);

    return (
        <SocketContext.Provider value={{ socket: socketRef.current }}>
            {children}
        </SocketContext.Provider>
    );
};

// Custom hook to use socket
export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error("useSocket must be used within a SocketProvider");
    }
    return context;
};
