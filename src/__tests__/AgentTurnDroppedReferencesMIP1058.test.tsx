/**
 * The calm note under an answer when the server could not use something the ask pointed at
 * (MIP-1058), and Retry re-sending the passage the turn was asked with. Rendered bare, like
 * `AgentTurn.test.tsx`: props only, labels from the real catalog.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AgentTurn, type AgentTurnProps } from "../features/agentQA/AgentTurn";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import { makeAskSelection } from "../features/agentQA/askSelection";
import type { AgentMentionRef } from "../features/agentQA/mentions/types";
import { getMessages, loadLocale } from "../i18n";

beforeAll(async () => {
    await loadLocale("ja");
});
afterEach(() => localStorage.clear());

const UUID = "5b0c3a52-6a31-4f1a-9a30-0e7f4a8f1c11";
const OTHER = "9d3a1b64-2c57-4c0e-8b5e-3f1a2b6c7d88";
const M1: AgentMentionRef = { kind: "message", messageId: UUID, label: "Alice 14:02" };
const M2: AgentMentionRef = { kind: "message", messageId: OTHER, label: "Bob 14:05" };

const en = getMessages("en");
const labelsEn = () => buildAgentTurnLabels(getMessages("en"), "spotlight");
const labelsJa = () => buildAgentTurnLabels(getMessages("ja"), "spotlight");

const renderTurn = (over: Partial<AgentTurnProps> = {}) => {
    const props: AgentTurnProps = {
        askedQuery: "What did she mean?",
        answer: "She meant Friday.",
        answerSources: [],
        askError: null,
        isCurrent: false,
        labels: labelsEn(),
        toolEvents: [],
        onPreview: vi.fn(),
        ...over,
    };
    render(
        <CssVarsProvider>
            <AgentTurn {...props} />
        </CssVarsProvider>
    );
    return props;
};

describe("the dropped-references note", () => {
    it("is absent when nothing was dropped", () => {
        renderTurn({ mentions: [M1] });
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("says it could not USE the message (never 'could not read'), and that it answered without it", () => {
        renderTurn({ mentions: [M1], droppedReferences: ["message"] });
        const note = screen.getByRole("status");
        expect(note.textContent).toBe(en.spotlight.dropped.message);
        expect(note.textContent).not.toMatch(/read/i);
    });

    it("says 'some of the messages' when the ask pointed at more than one", () => {
        renderTurn({ mentions: [M1, M2], droppedReferences: ["message"] });
        expect(screen.getByRole("status").textContent).toBe(en.spotlight.dropped.messages);
    });

    it("says it for the selection and for its source, one line each, and nothing about why", () => {
        renderTurn({ droppedReferences: ["selection", "selected_from"] });
        const note = screen.getByRole("status");
        expect(note.textContent).toContain(en.spotlight.dropped.selection);
        expect(note.textContent).toContain(en.spotlight.dropped.selectedFrom);
        for (const word of ["delete", "permission", "access", "exist", "private"]) {
            expect(note.textContent?.toLowerCase()).not.toContain(word);
        }
    });

    it("is in the member's language", () => {
        renderTurn({ labels: labelsJa(), mentions: [M1], droppedReferences: ["message"] });
        const ja = getMessages("ja").spotlight.dropped.message;
        expect(screen.getByRole("status").textContent).toBe(ja);
        expect(ja).not.toBe(en.spotlight.dropped.message);
    });

    it("keeps its icon out of the accessibility tree", () => {
        renderTurn({ droppedReferences: ["selection"] });
        const svg = screen.getByRole("status").querySelector("svg");
        expect(svg?.getAttribute("aria-hidden")).toBe("true");
    });
});

describe("Retry", () => {
    it("hands the turn's mentions and its selection back, verbatim", () => {
        const selection = makeAskSelection("the passage", M1)!;
        const onRetry = vi.fn();
        renderTurn({ mentions: [M1], selection, onRetry });
        fireEvent.click(screen.getByRole("button", { name: en.spotlight.actions.retry }));
        expect(onRetry).toHaveBeenCalledWith("What did she mean?", [M1], selection);
    });

    it("hands back no selection for a turn that had none", () => {
        const onRetry = vi.fn();
        renderTurn({ mentions: [M1], onRetry });
        fireEvent.click(screen.getByRole("button", { name: en.spotlight.actions.retry }));
        expect(onRetry).toHaveBeenCalledWith("What did she mean?", [M1], undefined);
    });
});
