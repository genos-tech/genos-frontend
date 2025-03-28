import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
    accessToken: string | null;
    setAccessToken: (token: string | null) => void;
}

const base_url = import.meta.env.VITE_API_BASE_URL;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [accessToken, setAccessToken] = useState<string | null>(null);

    // Function to refresh token
    const refreshAccessToken = async () => {
        try {
            const response = await fetch(`${base_url}/user/signin/refresh/`, {
                method: "GET",
                credentials: "include",
            });

            if (response.ok) {
                const data = await response.json();
                setAccessToken(data.access);
            } else {
                console.log("Failed to refresh token")
                setAccessToken(null); // Token refresh failed, user must log in
            }
        } catch (error) {
            console.error("Failed to refresh token", error);
            setAccessToken(null);
        }
    };

    useEffect(() => {
        if (accessToken === undefined || accessToken === null) {
            refreshAccessToken();
        }
    }, [accessToken]);

    // useEffect(() => {
    //     console.log("refresh:", accessToken)
    // }, [accessToken]);

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
