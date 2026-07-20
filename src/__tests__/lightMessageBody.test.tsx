/**
 * Fidelity + routing tests for the light message-body renderer.
 *
 * The fidelity test is the important one: it renders the SAME content
 * through a real read-only BlockNoteView and through `LightMessageBody`,
 * then compares the normalised markup. That is what backs the claim
 * that swapping the renderer doesn't change how a message looks — the
 * light path deliberately mirrors BlockNote's class/attribute structure
 * so every existing stylesheet rule keeps applying, and this test is
 * what stops that mirror from silently drifting.
 */

import { codeBlockOptions } from "@blocknote/code-block";
import {
    BlockNoteSchema,
    createCodeBlockSpec,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { canRenderLight } from "../components/messageBody/lightBodySupport";
import { LightMessageBody } from "../components/messageBody/LightMessageBody";

const ctx = {
    myself: { userId: "u1" } as any,
    setMyself: () => {},
    socket: null,
    useCM: {} as any,
    useTEM: { teamMemberProfiles: {} } as any,
    useUISM: {} as any,
};

const BnReference = ({ content }: { content: any[] }) => {
    const { audio, video, ...remainingBlockSpecs } = defaultBlockSpecs;
    const schema = BlockNoteSchema.create({
        inlineContentSpecs: { ...defaultInlineContentSpecs },
        blockSpecs: { ...remainingBlockSpecs, codeBlock: createCodeBlockSpec(codeBlockOptions) },
    });
    const editor = useCreateBlockNote({ schema, initialContent: content.slice(0, -1) });
    return (
        <BlockNoteView
            editable={false}
            editor={editor}
            filePanel={false}
            formattingToolbar={false}
            linkToolbar={false}
            sideMenu={false}
            slashMenu={false}
            tableHandles={false}
        />
    );
};

/** Strip everything that legitimately differs between the two paths:
 *  per-render block UUIDs, ProseMirror's editor-root classes/attrs, and
 *  whitespace. What's left is the structure that CSS actually targets. */
function normalize(root: Element | null): string {
    if (!root) return "";
    const clone = root.cloneNode(true) as Element;
    clone.querySelectorAll("[data-id]").forEach((el) => el.removeAttribute("data-id"));
    // ProseMirror marks its own editable plumbing; the light path has none.
    clone.querySelectorAll("[data-editable]").forEach((el) => el.removeAttribute("data-editable"));
    // Attribute ORDER is an artifact of how each renderer sets props and
    // has no effect on styling, so sort it away rather than contort the
    // source to match ProseMirror's ordering.
    clone.querySelectorAll("*").forEach((el) => {
        const attrs = Array.from(el.attributes)
            .map((a) => ({ name: a.name, value: a.value }))
            .sort((a, b) => a.name.localeCompare(b.name));
        attrs.forEach((a) => el.removeAttribute(a.name));
        attrs.forEach((a) => el.setAttribute(a.name, a.value));
    });
    return clone.innerHTML.replace(/\s+/g, " ").replace(/> </g, "><").trim();
}

const bodyOf = (container: HTMLElement) => normalize(container.querySelector(".bn-block-group"));

const cases: Array<{ name: string; content: any[] }> = [
    {
        name: "plain paragraph",
        content: [
            { type: "paragraph", content: [{ type: "text", text: "Hello world", styles: {} }] },
            { type: "paragraph", content: [] },
        ],
    },
    {
        name: "text styles",
        content: [
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "b", styles: { bold: true } },
                    { type: "text", text: "i", styles: { italic: true } },
                    { type: "text", text: "u", styles: { underline: true } },
                    { type: "text", text: "s", styles: { strike: true } },
                    { type: "text", text: "c", styles: { code: true } },
                ],
            },
            { type: "paragraph", content: [] },
        ],
    },
    {
        name: "coloured text",
        content: [
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "red", styles: { textColor: "red" } },
                    { type: "text", text: "bg", styles: { backgroundColor: "blue" } },
                ],
            },
            { type: "paragraph", content: [] },
        ],
    },
    {
        name: "headings",
        content: [
            {
                type: "heading",
                props: { level: 1 },
                content: [{ type: "text", text: "H1", styles: {} }],
            },
            {
                type: "heading",
                props: { level: 3 },
                content: [{ type: "text", text: "H3", styles: {} }],
            },
            { type: "paragraph", content: [] },
        ],
    },
    {
        name: "lists",
        content: [
            { type: "bulletListItem", content: [{ type: "text", text: "a", styles: {} }] },
            { type: "numberedListItem", content: [{ type: "text", text: "b", styles: {} }] },
            {
                type: "checkListItem",
                props: { checked: true },
                content: [{ type: "text", text: "c", styles: {} }],
            },
            { type: "paragraph", content: [] },
        ],
    },
    {
        name: "nested list",
        content: [
            {
                type: "bulletListItem",
                content: [{ type: "text", text: "parent", styles: {} }],
                children: [
                    {
                        type: "bulletListItem",
                        content: [{ type: "text", text: "child", styles: {} }],
                    },
                ],
            },
            { type: "paragraph", content: [] },
        ],
    },
    {
        name: "empty paragraph between text",
        content: [
            { type: "paragraph", content: [{ type: "text", text: "one", styles: {} }] },
            { type: "paragraph", content: [] },
            { type: "paragraph", content: [{ type: "text", text: "two", styles: {} }] },
            { type: "paragraph", content: [] },
        ],
    },
    {
        name: "text alignment",
        content: [
            {
                type: "paragraph",
                props: { textAlignment: "center" },
                content: [{ type: "text", text: "mid", styles: {} }],
            },
            { type: "paragraph", content: [] },
        ],
    },
];

describe("LightMessageBody fidelity vs BlockNote", () => {
    for (const c of cases) {
        it(`matches BlockNote markup: ${c.name}`, () => {
            const reference = render(<BnReference content={c.content} />);
            const expected = bodyOf(reference.container);
            reference.unmount();

            const light = render(<LightMessageBody content={c.content} {...ctx} />);
            const actual = bodyOf(light.container);

            expect(actual).toBe(expected);
        });
    }

    it("drops the trailing block like BnChatPreview does", () => {
        const content = [
            { type: "paragraph", content: [{ type: "text", text: "kept", styles: {} }] },
            { type: "paragraph", content: [{ type: "text", text: "dropped", styles: {} }] },
        ];
        const { container } = render(<LightMessageBody content={content} {...ctx} />);
        expect(container.textContent).toContain("kept");
        expect(container.textContent).not.toContain("dropped");
    });
});

describe("inline content stays valid inside <p>", () => {
    // jsdom does NOT enforce HTML nesting rules, so a `<div>`/`<p>` inside
    // the block's `<p class="bn-inline-content">` renders happily in tests
    // and only shows up as a React console error in a real browser —
    // which is exactly how it shipped once. Assert on the structure
    // instead of trusting the renderer.
    const BLOCK_LEVEL = "p, div, h1, h2, h3, ul, ol, li, section, article, blockquote";

    const expectNoBlockLevelInside = (container: HTMLElement) => {
        const offenders: string[] = [];
        container.querySelectorAll("p.bn-inline-content").forEach((p) => {
            p.querySelectorAll(BLOCK_LEVEL).forEach((el) => {
                offenders.push(`${el.tagName.toLowerCase()}.${el.className || "(no class)"}`);
            });
        });
        expect(offenders).toEqual([]);
    };

    it("renders a user mention with only inline elements", () => {
        const content = [
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "hi ", styles: {} },
                    { type: "mention", props: { userId: "u2", userName: "Ada" } },
                ],
            },
            { type: "paragraph", content: [] },
        ];
        const { container } = render(<LightMessageBody content={content} {...ctx} />);
        expect(container.textContent).toContain("@Ada");
        expectNoBlockLevelInside(container);
    });

    it("renders a group mention with only inline elements", () => {
        const content = [
            {
                type: "paragraph",
                content: [
                    {
                        type: "mentionGroup",
                        props: { groupId: "3", groupName: "devs", memberCount: "4" },
                    },
                ],
            },
            { type: "paragraph", content: [] },
        ];
        const { container } = render(<LightMessageBody content={content} {...ctx} />);
        expect(container.textContent).toContain("@devs");
        expectNoBlockLevelInside(container);
    });

    it("renders a custom emoji with only inline elements", () => {
        const content = [
            {
                type: "paragraph",
                content: [
                    {
                        type: "customEmoji",
                        props: { name: "party", url: "https://example.com/p.png" },
                    },
                ],
            },
            { type: "paragraph", content: [] },
        ];
        const { container } = render(<LightMessageBody content={content} {...ctx} />);
        expectNoBlockLevelInside(container);
    });

    it("renders a link with only inline elements", () => {
        const content = [
            {
                type: "paragraph",
                content: [
                    {
                        type: "link",
                        href: "https://example.com",
                        content: [{ type: "text", text: "site", styles: { bold: true } }],
                    },
                ],
            },
            { type: "paragraph", content: [] },
        ];
        const { container } = render(<LightMessageBody content={content} {...ctx} />);
        expectNoBlockLevelInside(container);
    });
});

describe("canRenderLight routing", () => {
    const wrap = (blocks: any[]) => [...blocks, { type: "paragraph", content: [] }];

    it("accepts plain and styled text", () => {
        expect(
            canRenderLight(
                wrap([
                    {
                        type: "paragraph",
                        content: [{ type: "text", text: "x", styles: { bold: true } }],
                    },
                ])
            )
        ).toBe(true);
    });

    it("accepts mention / mentionGroup / customEmoji", () => {
        for (const type of ["mention", "mentionGroup", "customEmoji"]) {
            expect(
                canRenderLight(wrap([{ type: "paragraph", content: [{ type, props: {} }] }]))
            ).toBe(true);
        }
    });

    it("rejects media, code and tables", () => {
        for (const type of ["image", "file", "video", "audio", "codeBlock", "table"]) {
            expect(canRenderLight(wrap([{ type, props: {} }]))).toBe(false);
        }
    });

    it("rejects hash mentions (not yet painted by the light path)", () => {
        expect(
            canRenderLight(
                wrap([{ type: "paragraph", content: [{ type: "hashTask", props: {} }] }])
            )
        ).toBe(false);
    });

    it("rejects an unknown style key so nothing renders unstyled", () => {
        expect(
            canRenderLight(
                wrap([
                    {
                        type: "paragraph",
                        content: [{ type: "text", text: "x", styles: { somethingNew: true } }],
                    },
                ])
            )
        ).toBe(false);
    });

    it("ignores a style key that is present but falsy", () => {
        expect(
            canRenderLight(
                wrap([
                    {
                        type: "paragraph",
                        content: [{ type: "text", text: "x", styles: { somethingNew: false } }],
                    },
                ])
            )
        ).toBe(true);
    });

    it("rejects nested unsupported children", () => {
        expect(
            canRenderLight(
                wrap([
                    {
                        type: "bulletListItem",
                        content: [],
                        children: [{ type: "image", props: {} }],
                    },
                ])
            )
        ).toBe(false);
    });

    it("rejects a non-array body", () => {
        expect(canRenderLight(undefined)).toBe(false);
        expect(canRenderLight({} as any)).toBe(false);
    });
});
