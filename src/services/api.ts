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
            // Client-aborted requests (e.g. spotlight supersedes an
            // in-flight search when the user keeps typing) reject with
            // no `error.response` too — but they aren't a backend
            // health signal, they're a deliberate frontend action.
            // Without this guard, a few fast keystrokes cross the
            // API_DOWN threshold and pop the "API down" snackbar.
            if (axios.isCancel(error)) {
                return Promise.reject(error);
            }
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
