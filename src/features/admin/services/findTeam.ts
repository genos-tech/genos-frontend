import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

export const findTeam = async (
    accessToken: string | null,
    teamId: string,
    setErrorMessage?: (value: string) => void
) => {
    const m = getMessages().admin.auth.errors;
    // No team selected yet — e.g. right after login (or the brief window
    // during demo sign-in) before the user has joined/created one. Probing
    // "does team '' exist?" is meaningless and the API rejects it with 400,
    // which then trips the global request-error toast on an otherwise clean
    // login. Short-circuit to a plain "not found" so callers fall through to
    // the team picker without a round-trip.
    if (!teamId) {
        return { exist: false };
    }
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${teamId}`;
            // findTeam is a probe that renders its own inline error (via the
            // setErrorMessage below). When a caller supplies that reporter,
            // opt out of the global "request failed" toast so an absent/failed
            // team isn't double-surfaced. Callers without an inline reporter
            // (e.g. the boot-time initCurrentTeam) keep the toast as their only
            // failure signal.
            const res = await api.get(`/team/exist/?${query}`, {
                suppressErrorToast: !!setErrorMessage,
            });
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage(m.tokenMissing);
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
            if (!error.response) {
                setErrorMessage?.(m.network);
            } else if (error.response.status === 404 || error.response.status === 500) {
                setErrorMessage?.(m.teamNotFound);
            } else {
                setErrorMessage?.(m.generic);
            }
        } else {
            console.error("Unexpected error:", error);
            setErrorMessage?.(m.unexpected);
        }
    }
};
