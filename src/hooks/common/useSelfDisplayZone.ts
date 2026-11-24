import { useMemo } from "react";

import { resolveDisplayZone } from "../../utils/userTimezone";

/**
 * The signed-in user's own display zone (manual location, else saved/detected
 * timezone, else the browser's), "UTC" when nothing resolves. Recomputed only
 * when the two fields the resolution reads change, not on every new `myself`
 * object.
 */
export const useSelfDisplayZone = (myself: { currentLocation?: string; timezone?: string }) => {
    const { currentLocation, timezone } = myself;
    return useMemo(
        () => resolveDisplayZone({ currentLocation, timezone }, true) ?? "UTC",
        [currentLocation, timezone]
    );
};
