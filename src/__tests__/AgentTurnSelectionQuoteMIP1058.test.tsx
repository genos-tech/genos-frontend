/**
 * A turn that was asked about a passage of selected text shows the passage as a quote under the
 * question (MIP-1058): read only, labelled, in the passage's own direction. A turn without one is
 * what it was.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { AgentTurn, type AgentTurnProps } from "../features/agentQA/AgentTurn";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import { getMessages, loadLocale } from "../i18n";

beforeAll(async () => {
    await loadLocale("ja");
});

const renderTurn = (over: Partial<AgentTurnProps> = {}, locale = "en") =>
    render(
        <CssVarsProvider>
            <AgentTurn
                answer="She meant Friday."
                answerSources={[]}
                askError={null}
                askedQuery="What did she mean?"
                isCurrent={false}
                labels={buildAgentTurnLabels(getMessages(locale as "en"), "spotlight")}
                toolEvents={[]}
                onPreview={vi.fn()}
                {...over}
            />
        </CssVarsProvider>
    );

describe("the quote of a selection under the question", () => {
    it("shows the passage, named for what it is", () => {
        renderTurn({ selection: { text: "ship it on Friday" } });
        const quote = screen.getByRole("group", {
            name: getMessages("en").spotlight.selection.label,
        });
        expect(within(quote).getByText("ship it on Friday")).toBeTruthy();
    });

    it("sits with the question, and the question is still there", () => {
        renderTurn({ selection: { text: "ship it on Friday" } });
        expect(screen.getByText("What did she mean?")).toBeTruthy();
    });

    it("is read only: nothing to remove", () => {
        renderTurn({ selection: { text: "ship it on Friday" } });
        expect(
            screen.queryByRole("button", { name: getMessages("en").spotlight.selection.remove })
        ).toBeNull();
    });

    it("takes the passage's own direction (an Arabic quote in an English UI reads right to left)", () => {
        renderTurn({ selection: { text: "الإطلاق يوم الجمعة" } });
        expect(screen.getByText("الإطلاق يوم الجمعة").getAttribute("dir")).toBe("auto");
    });

    it("is in the member's language", () => {
        renderTurn({ selection: { text: "金曜日に出す" } }, "ja");
        expect(
            screen.getByRole("group", { name: getMessages("ja").spotlight.selection.label })
        ).toBeTruthy();
    });

    it("a turn with no selection has no quote", () => {
        renderTurn();
        expect(
            screen.queryByRole("group", { name: getMessages("en").spotlight.selection.label })
        ).toBeNull();
    });
});
