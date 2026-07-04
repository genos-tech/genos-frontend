/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";

import { buildSourcesById, markdownToBlocks } from "../features/agentQA";
import type { SpotlightResult } from "../features/spotlight/types";

// Task source with the fields `sourceToUrl` needs to build a deep-link.
const taskSrc = (): SpotlightResult =>
    ({
        entity_type: "task",
        entity_id: "task:42",
        title: "framer-motion spike",
        task_id: "42",
        project_id: "5",
    }) as unknown as SpotlightResult;

const contentOf = (blocks: any[]): any[] => blocks[0].content;

describe("markdownToBlocks — citation links in saved notes", () => {
    it("converts a [prose](type:id) link into a deep-link block with the prose as text", () => {
        const sources = buildSourcesById([taskSrc()]);
        const blocks = markdownToBlocks(
            "The team [ruled out framer-motion](task:42) early.",
            sources
        );
        const content = contentOf(blocks);
        const link = content.find((n) => n.type === "link");
        expect(link).toBeTruthy();
        expect(link.href).toBe("/workspace/tasks/project/5/task/42");
        expect(link.content[0].text).toBe("ruled out framer-motion");
        expect(content.some((n) => n.type === "text" && n.text.includes("The team"))).toBe(true);
    });

    it("degrades an unresolved link to plain prose (no link, no raw markdown)", () => {
        const blocks = markdownToBlocks("See the [ghost task](task:99) here.", new Map());
        const content = contentOf(blocks);
        expect(content.some((n) => n.type === "link")).toBe(false);
        const joined = content.map((n) => (n.type === "text" ? n.text : "")).join("");
        expect(joined).toContain("ghost task");
        expect(joined).not.toContain("(task:99)");
    });

    it("still resolves a bare [type:id] token to a titled link", () => {
        const sources = buildSourcesById([taskSrc()]);
        const blocks = markdownToBlocks("Per the spike [task:42].", sources);
        const link = contentOf(blocks).find((n) => n.type === "link");
        expect(link.content[0].text).toBe("framer-motion spike");
        expect(link.href).toBe("/workspace/tasks/project/5/task/42");
    });
});
