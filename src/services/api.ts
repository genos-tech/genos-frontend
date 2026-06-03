import axios, { AxiosInstance } from "axios";

import { emitRequestError } from "./requestErrorNotifier";

// Per-request opt-out for the global error toast. Callers that render their
// own error UI from the failure (inline form validation off a 400 body, a
// deliberate 404 probe) set this in the request config; the response
// interceptor reads it off `error.config` and stays silent.
declare module "axios" {
    export interface AxiosRequestConfig {
        suppressErrorToast?: boolean;
    }
}

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
                // Network / server-unreachable: owned by the persistent
                // "API down" banner. No transient toast — a failure either
                // has a response or it doesn't, so the banner and the toast
                // below are mutually exclusive and never double-fire.
                _onApiHealthChange?.(true);
                return Promise.reject(error);
            }
            // HTTP error response while the server is reachable → transient
            // toast, classified by status. Skipped when the caller opted out
            // (`suppressErrorToast`), or on 401 — that's the auth-refresh path
            // (AuthContext retries / signs out), so toasting it would fire on
            // every normal token expiry.
            const status = error.response.status;
            if (!error.config?.suppressErrorToast && status !== 401) {
                if (status >= 500) {
                    emitRequestError("serverError");
                } else if (status === 403) {
                    emitRequestError("permissionDenied");
                } else {
                    emitRequestError("requestFailed");
                }
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
