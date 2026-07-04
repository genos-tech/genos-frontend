// FeedbackThumbs (F1) — the shared 👍/👎 component used by the
// thread/note Ask modal and the Spotlight overlay. The contract under
// test is the optimistic vote state machine: click applies the rating,
// re-clicking the active thumb clears it (rating 0), and switching
// thumbs replaces the vote — each transition calling onFeedback with
// the run id + the applied rating (matching the backend's idempotent
// upsert of rating ∈ {-1, 0, 1}).

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FeedbackThumbs } from "../features/agentQA/FeedbackThumbs";

const renderThumbs = (props: Parameters<typeof FeedbackThumbs>[0]) =>
    render(
        <CssVarsProvider>
            <FeedbackThumbs {...props} />
        </CssVarsProvider>
    );

describe("FeedbackThumbs", () => {
    it("submits 1 on thumbs-up, then 0 when the same thumb is re-clicked", async () => {
        const user = userEvent.setup();
        const onFeedback = vi.fn();
        renderThumbs({ runId: "run-42", onFeedback });

        await user.click(screen.getByTitle("Good answer"));
        expect(onFeedback).toHaveBeenLastCalledWith("run-42", 1);

        await user.click(screen.getByTitle("Good answer"));
        expect(onFeedback).toHaveBeenLastCalledWith("run-42", 0);
    });

    it("submits -1 on thumbs-down, and switching thumbs replaces the vote", async () => {
        const user = userEvent.setup();
        const onFeedback = vi.fn();
        renderThumbs({ runId: "run-42", onFeedback });

        await user.click(screen.getByTitle("Needs work"));
        expect(onFeedback).toHaveBeenLastCalledWith("run-42", -1);

        // Down → Up is a replacement, not a clear.
        await user.click(screen.getByTitle("Good answer"));
        expect(onFeedback).toHaveBeenLastCalledWith("run-42", 1);
    });

    it("uses the provided labels", async () => {
        const user = userEvent.setup();
        const onFeedback = vi.fn();
        renderThumbs({
            runId: "run-42",
            onFeedback,
            labels: { up: "良い回答", down: "要改善" },
        });

        await user.click(screen.getByTitle("良い回答"));
        expect(onFeedback).toHaveBeenLastCalledWith("run-42", 1);
        expect(screen.getByTitle("要改善")).toBeTruthy();
    });

    it("renders nothing without a runId (error/legacy turns)", () => {
        const onFeedback = vi.fn();
        const { container } = renderThumbs({ runId: null, onFeedback });
        expect(container.querySelectorAll("button").length).toBe(0);
    });

    it("renders nothing without an onFeedback handler", () => {
        const { container } = renderThumbs({ runId: "run-42" });
        expect(container.querySelectorAll("button").length).toBe(0);
    });
});
