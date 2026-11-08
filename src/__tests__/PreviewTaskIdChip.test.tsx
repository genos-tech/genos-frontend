import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PreviewTaskIdChip } from "../features/tasks/components/PreviewTaskIdChip";

const renderChip = (task: { displayId?: string | null; id?: number | string | null }) =>
    render(
        <CssVarsProvider>
            <PreviewTaskIdChip task={task} />
        </CssVarsProvider>
    );

afterEach(() => {
    vi.restoreAllMocks();
});

// The milestone preview header passes `{ displayId, id: backing taskId }`
// (a Milestone is not a task row), so these pin what that shape renders.
describe("PreviewTaskIdChip", () => {
    it("shows a milestone's display id", () => {
        const { getByText } = renderChip({ displayId: "MIP-123", id: 99 });
        expect(getByText("MIP-123")).toBeTruthy();
    });

    it("falls back to the backing task id before the display id is backfilled", () => {
        const { getByText } = renderChip({ displayId: null, id: 99 });
        expect(getByText("#99")).toBeTruthy();
    });

    it("shows N/A when the milestone has no backing task at all", () => {
        const { getByText } = renderChip({ displayId: null, id: null });
        expect(getByText("N/A")).toBeTruthy();
    });

    it("copies the display id on click", () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
        });
        const { getByRole } = renderChip({ displayId: "MIP-123", id: 99 });
        // The id is a span with role=button (Tab, then Enter or Space also copies).
        fireEvent.click(getByRole("button"));
        expect(writeText).toHaveBeenCalledWith("MIP-123");
    });
});
