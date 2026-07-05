// SourceChips — the "sources used" chip row beneath agent answers
// (thread/note Ask + summaries). The contract under test is the click
// behaviour introduced with the cited-only chip rework: a chip tries
// the UrlLinkModal preview first (quick-look without losing the
// conversation) and falls back to the caller's `onSelectSource`
// navigate handler when no preview is possible — no provider, no
// deep-link URL for the source, or the entity kind isn't modal-able.
// Mirrors CitationAnchor's handleClick so chip and inline-link twins
// behave identically.

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SourceChips } from "../features/agentQA/SourceChips";
import type { SpotlightResult } from "../features/spotlight/types";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";

// Minimal SpotlightResult — SourceChips reads entity_type/title for the
// label and `sourceToUrl` reads the type-specific id fields.
const taskSource = {
    entity_type: "task",
    entity_id: "task:42",
    title: "framer-motion spike",
    task_id: "42",
    project_id: "7",
} as unknown as SpotlightResult;

// No deep-link URL: `sourceToUrl` has no todo branch → returns null.
const todoSource = {
    entity_type: "todo",
    entity_id: "todo:2026-07-03:item:117",
    title: "ship the fix",
} as unknown as SpotlightResult;

const renderChips = (
    sources: SpotlightResult[],
    opts: {
        onSelectSource?: (s: SpotlightResult) => void;
        openModalByHref?: (href: string) => "opened" | "navigated" | "external";
    }
) => {
    const chips = <SourceChips sources={sources} onSelectSource={opts.onSelectSource} />;
    return render(
        <CssVarsProvider>
            {opts.openModalByHref ? (
                <UrlLinkModalProvider value={{ openModalByHref: opts.openModalByHref }}>
                    {chips}
                </UrlLinkModalProvider>
            ) : (
                chips
            )}
        </CssVarsProvider>
    );
};

describe("SourceChips — preview-first click, navigate fallback", () => {
    it("opens the UrlLinkModal preview and does NOT navigate when the modal opens", async () => {
        const user = userEvent.setup();
        const onSelectSource = vi.fn();
        const openModalByHref = vi.fn().mockReturnValue("opened" as const);
        renderChips([taskSource], { onSelectSource, openModalByHref });

        await user.click(screen.getByRole("button", { name: /framer-motion spike/ }));
        expect(openModalByHref).toHaveBeenCalledWith("/workspace/tasks/project/7/task/42");
        expect(onSelectSource).not.toHaveBeenCalled();
    });

    it("falls back to onSelectSource when the href isn't modal-able", async () => {
        const user = userEvent.setup();
        const onSelectSource = vi.fn();
        const openModalByHref = vi.fn().mockReturnValue("navigated" as const);
        renderChips([taskSource], { onSelectSource, openModalByHref });

        await user.click(screen.getByRole("button", { name: /framer-motion spike/ }));
        expect(onSelectSource).toHaveBeenCalledWith(taskSource);
    });

    it("falls back to onSelectSource outside a UrlLinkModalProvider", async () => {
        const user = userEvent.setup();
        const onSelectSource = vi.fn();
        renderChips([taskSource], { onSelectSource });

        await user.click(screen.getByRole("button", { name: /framer-motion spike/ }));
        expect(onSelectSource).toHaveBeenCalledWith(taskSource);
    });

    it("falls back to onSelectSource when the source has no deep-link URL", async () => {
        const user = userEvent.setup();
        const onSelectSource = vi.fn();
        const openModalByHref = vi.fn();
        renderChips([todoSource], { onSelectSource, openModalByHref });

        await user.click(screen.getByRole("button", { name: /ship the fix/ }));
        expect(openModalByHref).not.toHaveBeenCalled();
        expect(onSelectSource).toHaveBeenCalledWith(todoSource);
    });
});
