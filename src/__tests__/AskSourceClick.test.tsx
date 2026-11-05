// What a click on a cited source does inside the thread / note Ask modals.
// (Moved from SourceChips.test.tsx, whose subject, the Ask-only chip row, is
// gone: chips are now the shared answer turn's.)
//
// The contract: a chip or an inline citation tries the UrlLinkModal preview
// first (quick-look without losing the conversation) and falls back to the
// host's `onSelectSource` navigate handler when no preview is possible: no
// provider, no deep-link URL for the source, or the entity kind isn't
// modal-able. A chip and its inline-link twin behave identically; the policy
// lives in `AgentQAConversation`, the one place that may read the modal
// context (Spotlight, above the provider, routes its own clicks).

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AgentQAConversation } from "../features/agentQA/AgentQAConversation";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import {
    EMPTY_ASK_STATE,
    type CompletedTurn,
    type UseAgentQAReturn,
} from "../features/agentQA/types";
import type { SpotlightResult } from "../features/spotlight/types";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import { getMessages } from "../i18n";

// Minimal SpotlightResult: the chip label reads entity_type/title and
// `sourceToUrl` reads the type-specific id fields.
const taskSource = {
    entity_type: "task",
    entity_id: "task:42",
    title: "framer-motion spike",
    task_id: "42",
    project_id: "7",
} as unknown as SpotlightResult;

// Deep-links via the entity_id (`/workspace/todo/:localDate/item/:id`).
const todoSource = {
    entity_type: "todo",
    entity_id: "todo:2026-07-03:item:117",
    title: "ship the fix",
} as unknown as SpotlightResult;

// No deep-link URL: `sourceToUrl` can't parse this legacy-mangled
// entity_id (empty date) → returns null.
const brokenTodoSource = {
    entity_type: "todo",
    entity_id: "todo::item:117",
    title: "legacy todo",
} as unknown as SpotlightResult;

// The answer cites the source twice: as an inline link ("the <title>") and
// as a bare token, which the chip row picks up.
const turnFor = (source: SpotlightResult, linkText: string): CompletedTurn => ({
    id: 1,
    askedQuery: "what happened?",
    answer: `See [${linkText}](${source.entity_id}) and [${source.entity_id}].`,
    answerSources: [source],
    toolEvents: [],
    askError: null,
    runId: null,
});

const labels = {
    conversation: { empty: "", placeholder: "", send: "", cancel: "" },
    mentions: { ariaLabel: "" },
};

const renderConversation = (
    turn: CompletedTurn,
    opts: {
        onSelectSource?: (s: SpotlightResult) => void;
        openModalByHref?: (href: string) => "opened" | "navigated" | "external";
    }
) => {
    const state = {
        ask: { ...EMPTY_ASK_STATE },
        turns: [turn],
        onAsk: vi.fn(),
        submitFeedback: vi.fn(),
    } as unknown as UseAgentQAReturn;
    const conversation = (
        <AgentQAConversation
            isDark={false}
            labels={labels}
            state={state}
            turnLabels={buildAgentTurnLabels(getMessages("en"), "threadAsk")}
            onSelectSource={opts.onSelectSource}
        />
    );
    return render(
        <CssVarsProvider>
            {opts.openModalByHref ? (
                <UrlLinkModalProvider value={{ openModalByHref: opts.openModalByHref }}>
                    {conversation}
                </UrlLinkModalProvider>
            ) : (
                conversation
            )}
        </CssVarsProvider>
    );
};

// The same click, on the chip and on the inline link that cites the same source.
const TARGETS = [
    ["chip", (title: RegExp) => screen.getByRole("button", { name: title })],
    ["inline link", () => screen.getByRole("button", { name: "the link" })],
] as const;

describe.each(TARGETS)("a %s: preview-first click, navigate fallback", (_name, find) => {
    it("opens the UrlLinkModal preview and does NOT navigate when the modal opens", async () => {
        const user = userEvent.setup();
        const onSelectSource = vi.fn();
        const openModalByHref = vi.fn().mockReturnValue("opened" as const);
        renderConversation(turnFor(taskSource, "the link"), { onSelectSource, openModalByHref });

        await user.click(find(/framer-motion spike/));
        expect(openModalByHref).toHaveBeenCalledWith("/workspace/tasks/project/7/task/42");
        expect(onSelectSource).not.toHaveBeenCalled();
    });

    it("falls back to onSelectSource when the href isn't modal-able", async () => {
        const user = userEvent.setup();
        const onSelectSource = vi.fn();
        const openModalByHref = vi.fn().mockReturnValue("navigated" as const);
        renderConversation(turnFor(taskSource, "the link"), { onSelectSource, openModalByHref });

        await user.click(find(/framer-motion spike/));
        expect(onSelectSource).toHaveBeenCalledWith(taskSource);
    });

    it("falls back to onSelectSource outside a UrlLinkModalProvider", async () => {
        const user = userEvent.setup();
        const onSelectSource = vi.fn();
        renderConversation(turnFor(taskSource, "the link"), { onSelectSource });

        await user.click(find(/framer-motion spike/));
        expect(onSelectSource).toHaveBeenCalledWith(taskSource);
    });

    it("opens the todo preview from a todo source's entity_id", async () => {
        const user = userEvent.setup();
        const onSelectSource = vi.fn();
        const openModalByHref = vi.fn().mockReturnValue("opened" as const);
        renderConversation(turnFor(todoSource, "the link"), { onSelectSource, openModalByHref });

        await user.click(find(/ship the fix/));
        expect(openModalByHref).toHaveBeenCalledWith("/workspace/todo/2026-07-03/item/117");
        expect(onSelectSource).not.toHaveBeenCalled();
    });

    it("falls back to onSelectSource when the source has no deep-link URL", async () => {
        const user = userEvent.setup();
        const onSelectSource = vi.fn();
        const openModalByHref = vi.fn();
        renderConversation(turnFor(brokenTodoSource, "the link"), {
            onSelectSource,
            openModalByHref,
        });

        await user.click(find(/legacy todo/));
        expect(openModalByHref).not.toHaveBeenCalled();
        expect(onSelectSource).toHaveBeenCalledWith(brokenTodoSource);
    });
});
