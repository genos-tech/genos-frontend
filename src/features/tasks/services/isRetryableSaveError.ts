import axios from "axios";

/**
 * Whether a save that failed this way can succeed if it is sent again unchanged: the server never
 * answered, was down or overloaded, or the access token had just expired. Any other answer is a
 * refusal of this request, and an autosave that repeats it would only loop.
 */
export const isRetryableSaveError = (error: unknown): boolean => {
    if (!axios.isAxiosError(error)) return false;
    const status = error.response?.status;
    return status === undefined || status >= 500 || [401, 408, 429].includes(status);
};
