/**
 * An editable editor draws the host after a link itself (MIP-990).
 *
 * MIP-737's observer wrote `data-link-host` onto every link from outside. In an
 * editable editor that is a DOM change ProseMirror didn't make: it redraws the
 * link as a new `<a>`, the observer labels the new one, and so on about once a
 * frame. Measured in headless Chrome on the real editor, all three links of a
 * test document were replaced and ended with no host at all: no caption, and a
 * click landing on an element that was already gone.
 *
 * jsdom does NOT redraw the anchor (Chrome does), so this file cannot watch the
 * loop itself. It holds the cause instead, which jsdom does show: ProseMirror
 * receives the attribute write on an anchor and marks that range dirty. What is
 * pinned here: nothing writes into an editable editor's links from outside, the
 * editor puts the host on the anchor itself, and the host comes from the href.
 */

import { BlockNoteEditor } from "@blocknote/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { linkHostCaption, linkMarkView } from "../components/editors/sub/linkHostCaption";
import { LINK_HOST_ATTRIBUTE, startLabellingExternalLinks } from "../utils/labelExternalLinks";

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const frames = async (n: number) => {
    for (let i = 0; i < n; i++) await frame();
};

const link = (href: string, text: string) => ({ type: "link", href, content: text });
const paragraph = (...content: unknown[]) => ({ id: "p", type: "paragraph", content });

const mounted: { el: HTMLElement; editor: BlockNoteEditor<any, any, any> }[] = [];
let stopLabelling: () => void = () => {};

const make = (
    content: unknown[],
    { extension = true, editable = true }: { extension?: boolean; editable?: boolean } = {}
) => {
    const editor = BlockNoteEditor.create({
        initialContent: [paragraph(...content)] as never,
        ...(extension ? { extensions: [linkHostCaption] } : {}),
    } as never);
    const el = document.createElement("div");
    document.body.appendChild(el);
    editor.mount(el);
    editor.isEditable = editable;
    mounted.push({ el, editor });
    return { editor, el };
};

const anchors = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLAnchorElement>("a"));
const hosts = (el: HTMLElement) => anchors(el).map((a) => a.getAttribute(LINK_HOST_ATTRIBUTE));

/** Count what happens to the editor's links over `n` frames: anchors removed and
 *  attributes written on an anchor. */
const watch = async (el: HTMLElement, n: number) => {
    let removed = 0;
    let written = 0;
    const observer = new MutationObserver((records) => {
        for (const record of records) {
            if (record.type === "attributes" && record.target.nodeName === "A") written += 1;
            record.removedNodes.forEach((node) => {
                if (node.nodeName === "A" || (node as Element).querySelector?.("a")) removed += 1;
            });
        }
    });
    observer.observe(el, { subtree: true, childList: true, attributes: true });
    await frames(n);
    observer.disconnect();
    return { removed, written };
};

beforeEach(() => {
    document.body.innerHTML = "";
});

afterEach(() => {
    stopLabelling();
    stopLabelling = () => {};
    for (const { el, editor } of mounted.splice(0)) {
        editor.unmount();
        el.remove();
    }
});

describe("an editable editor with the extension", () => {
    it("puts the host on every external link, from its href", () => {
        const { el } = make([
            link("https://krakentech.slack.com/archives/C0/p1", "this"),
            { type: "text", text: " and ", styles: {} },
            link("https://docs.google.com/document/d/1/edit", "the note"),
        ]);

        expect(hosts(el)).toEqual(["krakentech.slack.com", "docs.google.com"]);
    });

    it("reads the host from the href, never from what the link says", () => {
        const { el } = make([link("https://attacker.example/x", "internal.company.com")]);

        expect(hosts(el)).toEqual(["attacker.example"]);
    });

    it("leaves a link to the app itself, a relative one and a non-web one uncaptioned", () => {
        const { el } = make([
            link(`${window.location.origin}/workspace/x`, "own"),
            link("/workspace/y", "relative"),
            link("mailto:a@b.example", "mail"),
        ]);

        expect(anchors(el)).toHaveLength(3);
        expect(hosts(el)).toEqual([null, null, null]);
    });

    it("keeps what BlockNote puts on a link: the href, the new-tab target, its rel and type", () => {
        const { el } = make([link("https://example.org/a?b=1&c=2", "x")]);
        const a = anchors(el)[0];

        expect(a.getAttribute("href")).toBe("https://example.org/a?b=1&c=2");
        expect(a.getAttribute("target")).toBe("_blank");
        expect(a.getAttribute("rel")).toContain("noopener");
        expect(a.getAttribute("data-inline-content-type")).toBe("link");
        expect(a.textContent).toBe("x");
    });

    it("gives a link whose href is edited the new host", async () => {
        const { editor, el } = make([link("https://one.example/x", "go")]);
        expect(hosts(el)).toEqual(["one.example"]);

        editor.updateBlock("p", { content: [link("https://two.example/y", "go")] } as never);
        await frame();

        expect(hosts(el)).toEqual(["two.example"]);
    });

    it("is not touched from outside while the labeller runs: no anchor is rewritten or replaced", async () => {
        const { el } = make([
            link("https://krakentech.slack.com/a", "this"),
            link("https://docs.google.com/b", "that"),
        ]);
        const before = anchors(el);
        stopLabelling = startLabellingExternalLinks(document);

        const seen = await watch(el, 12);

        expect(seen).toEqual({ removed: 0, written: 0 });
        expect(anchors(el)).toEqual(before);
        expect(hosts(el)).toEqual(["krakentech.slack.com", "docs.google.com"]);
    });
});

describe("what the mark view must not change", () => {
    // Every editable editor now draws its links through this view instead of
    // BlockNote's own rendering, so BlockNote's guards have to survive it: a link
    // with an unsafe URL (MIP-821) is drawn the way BlockNote draws it, and a safe
    // one differs only by the host attribute.
    const render = (href: string, extension: boolean) => {
        const { el } = make([link(href, "label")], { extension });
        return anchors(el)[0];
    };
    const withoutHost = (a: HTMLAnchorElement) => {
        const copy = a.cloneNode(true) as HTMLAnchorElement;
        copy.removeAttribute(LINK_HOST_ATTRIBUTE);
        return copy.outerHTML;
    };

    it.each([
        "https://example.org/a?b=1",
        "http://example.org/",
        "mailto:a@b.example",
        "/workspace/relative",
        "javascript:alert(1)",
        "JaVaScRiPt:alert(1)",
        "data:text/html,<script>alert(1)</script>",
    ])("draws %s exactly as BlockNote does, apart from the host", (href) => {
        expect(withoutHost(render(href, true))).toBe(withoutHost(render(href, false)));
    });

    it.each(["javascript:alert(1)", "data:text/html,x"])(
        "keeps BlockNote's guard: %s is not a live href and has no caption",
        (href) => {
            const a = render(href, true);

            expect(a.getAttribute("href") ?? "").toBe("");
            expect(a.hasAttribute(LINK_HOST_ATTRIBUTE)).toBe(false);
        }
    );
});

describe("an editable editor WITHOUT the extension", () => {
    it("is never written to by the labeller: no caption, but no redraw either", async () => {
        const { el } = make([link("https://krakentech.slack.com/a", "this")], {
            extension: false,
        });
        stopLabelling = startLabellingExternalLinks(document);

        const seen = await watch(el, 12);

        // The write is what makes ProseMirror redraw the link. Not writing is the
        // safe failure: an editor that forgot the extension loses its caption and
        // nothing else.
        expect(seen).toEqual({ removed: 0, written: 0 });
        expect(hosts(el)).toEqual([null]);
    });
});

describe("a read-only editor", () => {
    it("is still captioned by the labeller", async () => {
        const { el } = make([link("https://krakentech.slack.com/a", "this")], {
            extension: false,
            editable: false,
        });
        stopLabelling = startLabellingExternalLinks(document);
        await frames(2);

        expect(hosts(el)).toEqual(["krakentech.slack.com"]);
    });

    it("is not redrawn by that either, with the extension on", async () => {
        const { el } = make([link("https://krakentech.slack.com/a", "this")], {
            editable: false,
        });
        stopLabelling = startLabellingExternalLinks(document);

        const seen = await watch(el, 8);

        expect(seen.removed).toBe(0);
        expect(hosts(el)).toEqual(["krakentech.slack.com"]);
    });
});

describe("the link mark view", () => {
    const mark = (spec: unknown, href: unknown = "https://example.org/x") => ({
        attrs: { href },
        type: { spec: { toDOM: () => spec } },
    });

    it("hands ProseMirror its usual rendering when the mark's spec is not one it understands", () => {
        for (const spec of [
            undefined,
            "a",
            ["a", 0],
            ["a", { href: "x" }, "text"],
            ["a", { href: "x" }, 0, 0],
            ["a", { "xlink href": "x" }, 0],
            ["a", [], 0],
        ]) {
            expect(linkMarkView(mark(spec), null, true)).toEqual({});
        }
        expect(linkMarkView({ attrs: {}, type: { spec: {} } } as never, null, true)).toEqual({});
    });

    it("builds the anchor from the spec's own tag and attributes, skipping empty ones", () => {
        const view = linkMarkView(
            mark(["a", { href: "https://example.org/x", target: "_blank", title: null }, 0]),
            null,
            true
        ) as { dom: HTMLElement; contentDOM: HTMLElement };

        expect(view.dom.tagName).toBe("A");
        expect(view.contentDOM).toBe(view.dom);
        expect(view.dom.getAttribute("target")).toBe("_blank");
        expect(view.dom.hasAttribute("title")).toBe(false);
        expect(view.dom.getAttribute(LINK_HOST_ATTRIBUTE)).toBe("example.org");
    });

    it("captions nothing when the mark has no usable href", () => {
        // Built by hand: a default parameter would turn `undefined` into a real URL.
        const withAttrs = (attrs: Record<string, unknown>) => ({
            attrs,
            type: { spec: { toDOM: () => ["a", {}, 0] } },
        });
        for (const attrs of [{ href: null }, {}, { href: "" }, { href: 7 }]) {
            const view = linkMarkView(withAttrs(attrs), null, true) as { dom: HTMLElement };
            expect(view.dom.hasAttribute(LINK_HOST_ATTRIBUTE)).toBe(false);
        }
    });
});
