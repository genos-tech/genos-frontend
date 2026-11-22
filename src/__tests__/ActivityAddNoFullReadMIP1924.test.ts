import "fake-indexeddb/auto";

import { describe, expect, it, vi } from "vitest";

import { ActivityService } from "../db/services";
import { activityHandlers } from "../db/workers/handlers/activity.handlers";
import type { ActivityMessageProps } from "../types/chat";

// MIP-1924: every incoming activity used to read the whole activity store back
// ("sanity check") and discard it.

describe("addActivityMessage (MIP-1924)", () => {
    it("writes the row and does not read the whole store", async () => {
        const add = vi
            .spyOn(ActivityService.prototype, "addActivityMessage")
            .mockResolvedValue(true);
        const readAll = vi.spyOn(ActivityService.prototype, "getAllActivityMessages");
        const activityMessage = { activityId: "a1" } as unknown as ActivityMessageProps;

        await activityHandlers.addActivityMessage({ activityMessage });

        expect(add).toHaveBeenCalledWith(activityMessage);
        expect(readAll).toHaveBeenCalledTimes(0);
    });
});
