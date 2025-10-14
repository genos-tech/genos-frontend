import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";

interface AuthContextType {
    accessToken: string | null;
    setAccessToken: (token: string | null) => void;
}

const base_url = import.meta.env.VITE_API_BASE_URL;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Function to refresh token (single attempt)
    const refreshAccessToken = async (): Promise<boolean> => {
        console.log("[AUTH] Refreshing token");
        try {
            const response = await fetch(`${base_url}/user/signin/refresh/`, {
                method: "GET",
                credentials: "include",
            });

            if (response.ok) {
                const data = await response.json();
                setAccessToken(data.access);
                console.log("[AUTH] Token refreshed successfully");
                return true;
            } else {
                console.error("[AUTH] Token refresh failed");
                return false;
            }
        } catch (error) {
            console.error("[AUTH] Token refresh failed");
            console.error(error);
            return false;
        }
    };

    // Function to keep retrying token refresh until successful
    const startTokenRefreshRetry = () => {
        if (isRefreshing) return; // Prevent multiple retry cycles

        setIsRefreshing(true);
        console.log("[AUTH] Starting token refresh retry cycle");

        const attemptRefresh = async () => {
            const success = await refreshAccessToken();

            if (success) {
                // Success - clear interval and stop retrying
                if (refreshIntervalRef.current) {
                    clearInterval(refreshIntervalRef.current);
                    refreshIntervalRef.current = null;
                }
                setIsRefreshing(false);
                console.log("[AUTH] Token refresh retry cycle completed successfully");
            } else {
                console.log("[AUTH] Token refresh failed, retrying in 5 seconds...");
            }
        };

        // First attempt immediately
        attemptRefresh();

        // Set up interval for subsequent attempts
        refreshIntervalRef.current = setInterval(attemptRefresh, 5000);
    };

    // Cleanup function
    const clearRefreshInterval = () => {
        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
        }
        setIsRefreshing(false);
    };

    useEffect(() => {
        if (accessToken === null) {
            startTokenRefreshRetry();
        } else if (accessToken) {
            console.log("[AUTH] Token is valid");
            clearRefreshInterval(); // Clear any ongoing refresh attempts
        }
    }, [accessToken]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearRefreshInterval();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ accessToken, setAccessToken }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
