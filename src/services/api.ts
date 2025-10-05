import axios from "axios";

export const nonAuthApi = () => {
    return axios.create({
        baseURL: import.meta.env.VITE_API_BASE_URL,
        withCredentials: true,
        headers: {
            "Content-Type": "application/json",
        },
    });
};

export const authApi = (accessToken: string | null | undefined) => {
    if (!accessToken || accessToken === "") {
        console.warn("[API] No access token provided. HTTP request will not be sent.");
        return null;
    }
    return axios.create({
        baseURL: import.meta.env.VITE_API_BASE_URL,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
    });
};
