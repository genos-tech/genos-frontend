import type { Sprint } from "../types";

/**
 * Where a sprint sits relative to `todayIso`, the VIEWER's calendar day (`todayCalendarIso()`,
 * never the UTC date: MIP-1898). Dates are `YYYY-MM-DD`, compared as strings.
 */
export const sprintBucketOf = (
    s: Pick<Sprint, "startDate" | "endDate">,
    todayIso: string
): "past" | "current" | "upcoming" => {
    if (s.endDate < todayIso) return "past";
    if (s.startDate <= todayIso && todayIso <= s.endDate) return "current";
    return "upcoming";
};
