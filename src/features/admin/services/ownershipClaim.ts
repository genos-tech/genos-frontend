/**
 * Break-glass team-ownership recovery — `/api/v2/team/ownership-claim/`.
 *
 * An editor asks the current owner for ownership; if the owner neither
 * approves nor rejects before the deadline, the editor may take it. See
 * `origin/services/ownership_claim.py` for the policy and why the
 * deadline is the evidence rather than an inactivity check.
 *
 * WHY THIS ISN'T A SOCKET CALL. Every other inbox request type approves
 * and rejects over Socket.IO (`approve_join_team_request` and friends).
 * This one is plain HTTP: the guards — deadline, re-checked eligibility,
 * the owner-changed race — all live in the Django view under a row lock,
 * and routing it through the sockets service would only add a hop that
 * has to forward the JWT and re-implement nothing. The cost is that a
 * response isn't pushed live, so callers refetch instead.
 *
 * Nothing here is an authorisation check. `canRequest` / `canFinalize`
 * decide what to *show*; the server re-checks every one of them.
 */
import axios from "axios";

import { authApi } from "../../../services/api";

export type OwnershipClaim = {
    itemId: number;
    /** ISO; null only for a row that predates the current shape. */
    deadline: string | null;
    status: string;
    /** Did I file this? The owner sees it in their inbox instead. */
    isMine: boolean;
    claimantId: string | null;
    canFinalize: boolean;
};

export type OwnershipClaimStatus = {
    claim: OwnershipClaim | null;
    canRequest: boolean;
    /** ISO end of my rejection cooldown, when one is running. */
    retryAfter: string | null;
    responseDays: number;
};

const errorText = (error: unknown, fallback: string): string => {
    if (axios.isAxiosError(error)) {
        return (error.response?.data as { error?: string })?.error || fallback;
    }
    return fallback;
};

/**
 * GET the open claim on a team, from the caller's side.
 *
 * The claimant's ONLY view of their own claim: it's an inbox row
 * addressed to the owner, so it never appears in the claimant's own
 * inbox. Returns null when the call fails, so the caller renders the
 * team profile without claim UI rather than an error.
 */
export const getOwnershipClaim = async (
    accessToken: string | null,
    teamId: string
): Promise<OwnershipClaimStatus | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get("/team/ownership-claim/", { params: { team_id: teamId } });
        return res.data as OwnershipClaimStatus;
    } catch {
        return null;
    }
};

/** POST — file a claim. Editors only; the server re-checks. */
export const requestOwnershipClaim = async (
    accessToken: string | null,
    teamId: string,
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return false;
        }
        await api.post("/team/ownership-claim/request/", { team_id: teamId });
        return true;
    } catch (error: unknown) {
        setErrorMessage?.(errorText(error, "Couldn't request ownership. Please try again."));
        return false;
    }
};

/**
 * POST — the current owner approves or rejects a claim against them.
 *
 * Approving transfers immediately. Rejecting closes the claim and puts
 * the claimant on cooldown.
 */
export const respondToOwnershipClaim = async (
    accessToken: string | null,
    itemId: number,
    decision: "approve" | "reject",
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return false;
        }
        await api.post("/team/ownership-claim/respond/", { item_id: itemId, decision });
        return true;
    } catch (error: unknown) {
        setErrorMessage?.(errorText(error, "Couldn't respond to the request. Please try again."));
        return false;
    }
};

/** POST — the claimant takes ownership after the deadline passes. */
export const finalizeOwnershipClaim = async (
    accessToken: string | null,
    itemId: number,
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return false;
        }
        await api.post("/team/ownership-claim/finalize/", { item_id: itemId });
        return true;
    } catch (error: unknown) {
        setErrorMessage?.(errorText(error, "Couldn't take ownership. Please try again."));
        return false;
    }
};
