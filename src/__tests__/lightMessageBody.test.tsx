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
import { CssVarsProvider } from "@mui/joy";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canRenderLight } from "../components/messageBody/lightBodySupport";
import { LightMessageBody } from "../components/messageBody/LightMessageBody";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";

// The body renders PR unfurls, which read the access token. Keep the
// rest of AuthContext real so the surrounding module graph is unchanged.
const authState = vi.hoisted(() => ({ accessToken: null as string | null }));
vi.mock("../context/AuthContext", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useAuth: () => ({ accessToken: authState.accessToken }),
}));

// Stand in for the real card, which fetches from GitHub and renders
// nothing when the integration isn't connected. What's under test here
// is the wiring — that the body finds PR urls and asks for a card — not
// the card's own behaviour.
vi.mock("../features/integrations/components/LinkedPrCard", () => ({
    LinkedPrCard: ({ url }: { url: string }) => <div data-testid="pr-card">{url}</div>,
}));

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

describe("link and PR-unfurl behaviour carries over from BnChatPreview", () => {
    // Both of these are things the BlockNote path did that the light path
    // must keep doing — a message with a link, or with a PR URL sitting in
    // plain text, still qualifies for the light path, so losing them would
    // be a silent regression for a whole class of ordinary messages.
    afterEach(() => {
        authState.accessToken = null;
    });

    const linkContent = [
        {
            type: "paragraph",
            content: [
                {
                    type: "link",
                    href: "https://example.com/page",
                    content: [{ type: "text", text: "click me", styles: {} }],
                },
            ],
        },
        { type: "paragraph", content: [] },
    ];

    it("routes anchor clicks through the URL-link modal instead of navigating", async () => {
        const openModalByHref = vi.fn(() => "opened" as const);
        const user = userEvent.setup();

        render(
            <UrlLinkModalProvider value={{ openModalByHref }}>
                <LightMessageBody content={linkContent} {...ctx} />
            </UrlLinkModalProvider>
        );

        await user.click(screen.getByText("click me"));
        expect(openModalByHref).toHaveBeenCalledWith("https://example.com/page");
    });

    it("still renders the anchor when no modal provider is mounted", () => {
        const { container } = render(<LightMessageBody content={linkContent} {...ctx} />);
        const anchor = container.querySelector("a");
        expect(anchor?.getAttribute("href")).toBe("https://example.com/page");
    });

    it("unfurls a GitHub PR url found in plain text", () => {
        authState.accessToken = "token";
        const content = [
            {
                type: "paragraph",
                content: [
                    {
                        type: "text",
                        text: "see https://github.com/acme/repo/pull/42 please",
                        styles: {},
                    },
                ],
            },
            { type: "paragraph", content: [] },
        ];
        // The message itself must still qualify for the light path —
        // otherwise this would silently be testing the fallback.
        expect(canRenderLight(content)).toBe(true);

        render(
            <CssVarsProvider>
                <LightMessageBody content={content} {...ctx} />
            </CssVarsProvider>
        );
        expect(screen.getByTestId("pr-card").textContent).toBe(
            "https://github.com/acme/repo/pull/42"
        );
    });

    it("renders no unfurl when there is no PR url", () => {
        authState.accessToken = "token";
        render(
            <CssVarsProvider>
                <LightMessageBody content={linkContent} {...ctx} />
            </CssVarsProvider>
        );
        expect(screen.queryByTestId("pr-card")).toBeNull();
    });

    it("renders no unfurl when signed out", () => {
        authState.accessToken = null;
        const content = [
            {
                type: "paragraph",
                content: [
                    {
                        type: "text",
                        text: "https://github.com/acme/repo/pull/42",
                        styles: {},
                    },
                ],
            },
            { type: "paragraph", content: [] },
        ];
        render(
            <CssVarsProvider>
                <LightMessageBody content={content} {...ctx} />
            </CssVarsProvider>
        );
        expect(screen.queryByTestId("pr-card")).toBeNull();
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
