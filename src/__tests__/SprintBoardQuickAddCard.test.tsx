import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SprintBoardQuickAddCard } from "../features/tasks/components/board/SprintBoardQuickAddCard";
import { TaskFieldRules } from "../features/tasks/utils/taskFieldRules";
import { QuickAddRequiredFieldsPreferenceProvider } from "../hooks/common/useQuickAddRequiredFieldsPreference";
import { LimitReachedError } from "../services/limitErrors";

const PREF_KEY = "genos-quick-add-required-fields-preference:v1";
const PLACEHOLDER = "Task title…";
const TAGS = [
    { tagName: "bug", tagColor: "#f00" },
    { tagName: "ui", tagColor: "#00f" },
] as never[];

const renderCard = (
    overrides: Partial<Parameters<typeof SprintBoardQuickAddCard>[0]> = {},
    { enforce = false }: { enforce?: boolean } = {}
) => {
    window.localStorage.setItem(PREF_KEY, JSON.stringify({ enforce }));
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const utils = render(
        <CssVarsProvider>
            <QuickAddRequiredFieldsPreferenceProvider>
                <div data-testid="outside">outside</div>
                <SprintBoardQuickAddCard
                    creatorUserId="u1"
                    fieldRules={null}
                    projectId={42}
                    projectTags={TAGS}
                    teamMemberIds={["u1"]}
                    onClose={onClose}
                    onSubmit={onSubmit}
                    {...overrides}
                />
            </QuickAddRequiredFieldsPreferenceProvider>
        </CssVarsProvider>
    );
    const input = utils.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    const type = (value: string) => fireEvent.change(input, { target: { value } });
    return { ...utils, input, type, onSubmit, onClose };
};

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("SprintBoardQuickAddCard", () => {
    it("focuses the title so you can type straight away", () => {
        const { input } = renderCard();
        expect(document.activeElement).toBe(input);
    });

    it("Enter creates an Open task with the trimmed title, then closes", async () => {
        const { input, type, onSubmit, onClose } = renderCard();
        type("  Write the report  ");
        fireEvent.keyDown(input, { key: "Enter" });
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith({
            title: "Write the report",
            assigneeId: null,
            status: "Open",
            priority: null,
            effortLevel: null,
            dueDate: null,
            tags: [],
        });
    });

    it("does nothing on Enter with an empty title", () => {
        const { input, type, onSubmit, onClose } = renderCard();
        type("   ");
        fireEvent.keyDown(input, { key: "Enter" });
        expect(onSubmit).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it("Escape discards, even with a typed title", () => {
        const { input, type, onSubmit, onClose } = renderCard();
        type("half a thought");
        fireEvent.keyDown(input, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("a click outside discards only while the title is empty", () => {
        const first = renderCard();
        fireEvent.mouseDown(first.getByTestId("outside"));
        expect(first.onClose).toHaveBeenCalledTimes(1);
        first.unmount();

        const second = renderCard();
        second.type("keep me");
        fireEvent.mouseDown(second.getByTestId("outside"));
        expect(second.onClose).not.toHaveBeenCalled();
    });

    it("pressing a board card (a possible drag) does not discard it", () => {
        const { getByTestId, onClose } = renderCard();
        const card = document.createElement("div");
        card.setAttribute("data-rfd-draggable-id", "7");
        getByTestId("outside").appendChild(card);
        fireEvent.mouseDown(card);
        expect(onClose).not.toHaveBeenCalled();
    });

    it("a click inside the card does not discard it", () => {
        const { getByTestId, onClose } = renderCard();
        fireEvent.mouseDown(getByTestId("board-quick-add-card"));
        expect(onClose).not.toHaveBeenCalled();
    });

    it("keeps the draft and shows the error when the create fails", async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error("boom"));
        const { input, type, findByRole, onClose } = renderCard({ onSubmit });
        type("Will fail");
        fireEvent.keyDown(input, { key: "Enter" });
        expect((await findByRole("alert")).textContent).toBe("Couldn't create — try again");
        expect(input.value).toBe("Will fail");
        expect(onClose).not.toHaveBeenCalled();
    });

    it("shows a plan-limit message as it is", async () => {
        const onSubmit = vi
            .fn()
            .mockRejectedValue(new LimitReachedError("You've used 5 of 5 tasks"));
        const { input, type, findByRole } = renderCard({ onSubmit });
        type("One too many");
        fireEvent.keyDown(input, { key: "Enter" });
        expect((await findByRole("alert")).textContent).toBe("You've used 5 of 5 tasks");
    });

    it("a second Enter while the create is in flight does not create twice", async () => {
        let resolve: () => void = () => {};
        const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));
        const { input, type, onClose } = renderCard({ onSubmit });
        type("Once");
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(onSubmit).toHaveBeenCalledTimes(1);
        await act(async () => resolve());
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("seeds priority from the project's defaults", async () => {
        const rules: TaskFieldRules = { priority: { default: "High" } };
        const { input, type, onSubmit, onClose } = renderCard({ fieldRules: rules });
        type("Defaulted");
        fireEvent.keyDown(input, { key: "Enter" });
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(onSubmit.mock.calls[0][0].priority).toBe("High");
    });

    describe("required fields from the project's rules", () => {
        const rules: TaskFieldRules = { tags: { required: true } };

        it("do not block by default (quick-add is the fast path)", async () => {
            const { input, type, onSubmit } = renderCard({ fieldRules: rules });
            type("No tag");
            fireEvent.keyDown(input, { key: "Enter" });
            await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        });

        it("block when the user opted in, and name the missing field", async () => {
            const { input, type, onSubmit, findByRole } = renderCard(
                { fieldRules: rules },
                { enforce: true }
            );
            type("No tag");
            fireEvent.keyDown(input, { key: "Enter" });
            expect((await findByRole("alert")).textContent).toContain("Required:");
            expect(onSubmit).not.toHaveBeenCalled();
        });
    });
});
