// FeedbackThumbs (F1) — the shared 👍/👎 component used by the
// thread/note Ask modal and the Spotlight overlay. The contract under
// test is the ONE-SHOT vote: the first click applies the rating and
// locks both buttons, a persisted vote re-opens locked + pre-selected,
// and a seeded rating (initialRating) also opens locked — so a user
// rates a given answer exactly once per response.

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackThumbs } from "../features/agentQA/FeedbackThumbs";

const renderThumbs = (props: Parameters<typeof FeedbackThumbs>[0]) =>
    render(
        <CssVarsProvider>
            <FeedbackThumbs {...props} />
        </CssVarsProvider>
    );

// The buttons are icon-only, so their label lives on `aria-label` (and
// is also what the tooltip says). Query by accessible name rather than
// the tooltip's own markup.
const thumb = (label: string) => screen.getByRole("button", { name: label }) as HTMLButtonElement;

const isDisabled = (label: string) => thumb(label).disabled === true;

describe("FeedbackThumbs", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        localStorage.clear();
    });

    it("submits 1 on thumbs-up, then locks both buttons", async () => {
        const user = userEvent.setup();
        const onFeedback = vi.fn();
        renderThumbs({ runId: "run-42", onFeedback });

        await user.click(thumb("Good answer"));
        expect(onFeedback).toHaveBeenCalledTimes(1);
        expect(onFeedback).toHaveBeenLastCalledWith("run-42", 1);

        // One-shot: both thumbs are now locked (can't re-vote / switch).
        expect(isDisabled("Good answer")).toBe(true);
        expect(isDisabled("Needs work")).toBe(true);
    });

    it("submits -1 on thumbs-down, then locks both buttons", async () => {
        const user = userEvent.setup();
        const onFeedback = vi.fn();
        renderThumbs({ runId: "run-42", onFeedback });

        await user.click(thumb("Needs work"));
        expect(onFeedback).toHaveBeenCalledTimes(1);
        expect(onFeedback).toHaveBeenLastCalledWith("run-42", -1);
        expect(isDisabled("Good answer")).toBe(true);
        expect(isDisabled("Needs work")).toBe(true);
    });

    it("persists the vote so a re-mount opens locked (no re-vote)", async () => {
        const user = userEvent.setup();
        const onFeedback = vi.fn();
        const { unmount } = renderThumbs({ runId: "run-99", onFeedback });

        // Before voting the buttons are live.
        expect(isDisabled("Good answer")).toBe(false);
        await user.click(thumb("Good answer"));
        expect(onFeedback).toHaveBeenCalledTimes(1);
        unmount();

        // Re-open (fresh mount, same run) — the persisted vote seeds the
        // lock, so it opens disabled and pre-selected.
        renderThumbs({ runId: "run-99", onFeedback });
        expect(isDisabled("Good answer")).toBe(true);
        expect(isDisabled("Needs work")).toBe(true);
        expect(onFeedback).toHaveBeenCalledTimes(1);
    });

    it("opens locked when seeded via initialRating", () => {
        const onFeedback = vi.fn();
        renderThumbs({ runId: "run-7", onFeedback, initialRating: 1 });

        expect(isDisabled("Good answer")).toBe(true);
        expect(isDisabled("Needs work")).toBe(true);
        expect(onFeedback).not.toHaveBeenCalled();
    });

    it("uses the provided labels", async () => {
        const user = userEvent.setup();
        const onFeedback = vi.fn();
        renderThumbs({
            runId: "run-42",
            onFeedback,
            labels: { up: "良い回答", down: "要改善" },
        });

        await user.click(thumb("良い回答"));
        expect(onFeedback).toHaveBeenLastCalledWith("run-42", 1);
        expect(thumb("要改善")).toBeTruthy();
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
