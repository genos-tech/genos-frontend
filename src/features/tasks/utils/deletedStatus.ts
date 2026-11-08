/**
 * The one rule every status picker shares (MIP-1301): only a CHANGE to Deleted asks
 * for a confirm. Re-picking the status a task already has does nothing, and leaving
 * Deleted (bringing a task back) never asks.
 */
export const isDeletingStatus = (
    next: string | null | undefined,
    current: string | null | undefined
) => next === "Deleted" && current !== "Deleted";
