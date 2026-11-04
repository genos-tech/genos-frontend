/**
 * The behaviour behind MIP-1025, in a mounted editor: KaTeX and Mermaid are loaded when a
 * formula or a diagram is drawn, once, and not before. (`LazyRenderersGuard` proves the source
 * has no static import; this proves the editor really waits.)
 *
 * The two renderer modules are replaced by factories that count how often they are
 * EVALUATED, which is what a module load is.
 */
import {
    BlockNoteSchema,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
    type PartialBlock,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { render, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
    genosExtraBlockSpecs,
    genosExtraInlineContentSpecs,
} from "../components/editors/genosBlockSpecs";

const loads = vi.hoisted(() => ({ katex: 0, mermaid: 0 }));

vi.mock("../components/editors/blocks/katexModule", () => {
    loads.katex += 1;
    const katexToHtml = (source: string) => ({
        html: `<span class="katex-fake">${source}</span>`,
        error: undefined,
    });
    return { katexToHtml, default: {} };
});

vi.mock("../components/editors/blocks/mermaidModule", () => {
    loads.mermaid += 1;
    return {
        MERMAID_CONFIG: {},
        renderDiagramSvg: async (source: string) => `<svg data-fake="${source.length}"></svg>`,
        default: {},
    };
});

const schema = BlockNoteSchema.create({
    blockSpecs: { ...defaultBlockSpecs, ...genosExtraBlockSpecs },
    inlineContentSpecs: { ...defaultInlineContentSpecs, ...genosExtraInlineContentSpecs },
});

type Blocks = PartialBlock<typeof schema.blockSchema>[];

const Harness = ({ content }: { content: Blocks }) => {
    const editor = useCreateBlockNote({ schema, initialContent: content as never });
    return <BlockNoteView editor={editor} editable={false} />;
};

beforeAll(() => {
    // jsdom rects lack toJSON, which BlockNote's menus call.
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
        const rect = orig.call(this);
        (rect as unknown as { toJSON: () => unknown }).toJSON = () => rect;
        return rect;
    };
});

// The tests run in this order on purpose: each one starts where the one before left the
// module cache.
describe("the formula and diagram renderers load on first use", () => {
    it("an editor with neither a formula nor a diagram loads neither", async () => {
        const { container } = render(
            <Harness
                content={[
                    { type: "paragraph", content: "costs $5 and $10" },
                    { type: "codeBlock", content: "const a = 1;" },
                ]}
            />
        );
        await waitFor(() => expect(container.textContent).toContain("costs $5 and $10"));
        // Give a stray effect every chance to run.
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(loads).toEqual({ katex: 0, mermaid: 0 });
    });

    it("a diagram loads Mermaid, not KaTeX, and draws", async () => {
        const { container } = render(
            <Harness content={[{ type: "diagram", content: "graph TD\n A-->B" } as never]} />
        );
        await waitFor(() => expect(container.querySelector("svg[data-fake]")).not.toBeNull());
        expect(loads).toEqual({ katex: 0, mermaid: 1 });
    });

    it("a formula, block or inline, loads KaTeX once, shows the source first, then draws", async () => {
        const { container } = render(
            <Harness
                content={[
                    { type: "mathBlock", content: "x^2" } as never,
                    { type: "mathBlock", content: "y^2" } as never,
                    {
                        type: "paragraph",
                        content: [{ type: "math", content: "E=mc^2" } as never],
                    },
                ]}
            />
        );
        await waitFor(() => expect(container.querySelectorAll(".katex-fake")).toHaveLength(3));
        expect(loads.katex).toBe(1);
        expect(loads.mermaid).toBe(1);
    });

    it("a later formula is drawn from the cache, without a second load", async () => {
        const { container } = render(
            <Harness content={[{ type: "mathBlock", content: "z^2" } as never]} />
        );
        await waitFor(() => expect(container.querySelectorAll(".katex-fake")).toHaveLength(1));
        expect(loads.katex).toBe(1);
    });
});
