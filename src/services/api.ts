import axios, { AxiosInstance } from "axios";

type ApiHealthListener = (isDown: boolean) => void;

let _onApiHealthChange: ApiHealthListener | null = null;

export const registerApiHealthListener = (listener: ApiHealthListener) => {
    _onApiHealthChange = listener;
};

export const unregisterApiHealthListener = () => {
    _onApiHealthChange = null;
};

const attachInterceptors = (instance: AxiosInstance): AxiosInstance => {
    instance.interceptors.response.use(
        (response) => {
            _onApiHealthChange?.(false);
            return response;
        },
        (error) => {
            if (!error.response) {
                _onApiHealthChange?.(true);
            }
            return Promise.reject(error);
        }
    );
    return instance;
};

export const nonAuthApi = () => {
    return attachInterceptors(
        axios.create({
            baseURL: import.meta.env.VITE_API_BASE_URL,
            withCredentials: true,
            headers: {
                "Content-Type": "application/json",
            },
        })
    );
};

export const authApi = (accessToken: string | null | undefined) => {
    if (!accessToken || accessToken === "") {
        console.warn("[API] No access token provided. HTTP request will not be sent.");
        return null;
    }
    return attachInterceptors(
        axios.create({
            baseURL: import.meta.env.VITE_API_BASE_URL,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
        })
    );
};
