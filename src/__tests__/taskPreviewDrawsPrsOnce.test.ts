/**
 * A task's PRs are listed once in the task preview, in its Delivery block
 * (MIP-1001). The preview used to draw a Linked PR section too, and the two
 * lists disagreed: a PR merged before anyone opened the preview was in Delivery
 * (the webhook wrote it) but never in the task's `links`, so Linked PR missed it.
 * Only the milestone preview, which has no Delivery block, still draws it.
 * A source check, because the behaviour needs the whole preview tree to observe.
 */

import { describe, expect, it } from "vitest";

import taskPreviewSource from "../features/tasks/components/contents/TaskPreview.tsx?raw";

describe("TaskPreview", () => {
    it("draws the Linked PR section once, and only inside the milestone preview", () => {
        const uses = taskPreviewSource.split("<LinkedPrSection").length - 1;
        expect(uses).toBe(1);
        expect(taskPreviewSource.indexOf("<LinkedPrSection")).toBeGreaterThan(
            taskPreviewSource.indexOf("MilestonePreviewInner")
        );
    });
});
