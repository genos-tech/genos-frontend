/**
 * An external link in an editor says where it goes (MIP-737).
 *
 * MIP-723 prints the host after a link in rendered model output. A note the agent
 * writes becomes a real BlockNote document, where the same link showed no host to
 * anyone who opened it later. `labelExternalLinks` sets `data-link-host` on every
 * external link inside an editor and `App.css` prints it.
 *
 * What matters, in order: the host is read from the HREF and never the label (the
 * label is the author's text); same-origin and non-web links are not labelled;
 * it covers links added later and links whose href is edited in place; and it
 * touches nothing outside an editor.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    labelAnchor,
    labelExternalLinksIn,
    LINK_HOST_ATTRIBUTE,
    startLabellingExternalLinks,
} from "../utils/labelExternalLinks";

const editorWith = (html: string): HTMLElement => {
    const editor = document.createElement("div");
    editor.className = "bn-editor";
    editor.innerHTML = html;
    document.body.appendChild(editor);
    return editor;
};

const anchor = (root: ParentNode, selector = "a") =>
    root.querySelector(selector) as HTMLAnchorElement;

const flush = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const settle = async () => {
    // A mutation record, then the animation frame the work waits for.
    await Promise.resolve();
    await flush();
    await flush();
};

beforeEach(() => {
    document.body.innerHTML = "";
});

describe("labelling one anchor", () => {
    it("sets the host of an external https link", () => {
        const editor = editorWith('<a href="https://attacker.example/x">the design doc</a>');

        expect(labelAnchor(anchor(editor))).toBe(true);

        expect(anchor(editor).getAttribute(LINK_HOST_ATTRIBUTE)).toBe("attacker.example");
    });

    it("includes a port, because that is part of where it goes", () => {
        const editor = editorWith('<a href="https://example.com:8443/x">x</a>');

        labelAnchor(anchor(editor));

        expect(anchor(editor).getAttribute(LINK_HOST_ATTRIBUTE)).toBe("example.com:8443");
    });

    it("takes the host from the href, never from the label", () => {
        const editor = editorWith('<a href="https://attacker.example/x">internal.company.com</a>');

        labelAnchor(anchor(editor));

        expect(anchor(editor).getAttribute(LINK_HOST_ATTRIBUTE)).toBe("attacker.example");
        expect(anchor(editor).getAttribute(LINK_HOST_ATTRIBUTE)).not.toContain("company");
    });

    it("does not read a look-alike host out of the path or userinfo", () => {
        const editor = editorWith(
            '<a href="https://attacker.example/https://internal.company.com">a</a>' +
                '<a href="https://internal.company.com@attacker.example/">b</a>'
        );

        const [a, b] = Array.from(editor.querySelectorAll("a"));
        labelAnchor(a);
        labelAnchor(b);

        expect(a.getAttribute(LINK_HOST_ATTRIBUTE)).toBe("attacker.example");
        expect(b.getAttribute(LINK_HOST_ATTRIBUTE)).toBe("attacker.example");
    });

    it("labels http as well as https", () => {
        const editor = editorWith('<a href="http://plain.example/">x</a>');

        labelAnchor(anchor(editor));

        expect(anchor(editor).getAttribute(LINK_HOST_ATTRIBUTE)).toBe("plain.example");
    });

    it("does not label a link to the app's own origin", () => {
        const own = window.location.origin;
        const editor = editorWith(`<a href="${own}/workspace/tasks/1">x</a>`);

        expect(labelAnchor(anchor(editor))).toBe(false);

        expect(anchor(editor).hasAttribute(LINK_HOST_ATTRIBUTE)).toBe(false);
    });

    it("does not label a relative link, which is the app's own", () => {
        const editor = editorWith('<a href="/workspace/notes/my/12">x</a><a href="#top">y</a>');

        for (const a of Array.from(editor.querySelectorAll("a"))) labelAnchor(a);

        expect(editor.querySelector(`[${LINK_HOST_ATTRIBUTE}]`)).toBeNull();
    });

    it("does not label a non-web link", () => {
        const editor = editorWith(
            '<a href="mailto:a@b.co">m</a><a href="tel:+81000">t</a><a href="javascript:alert(1)">j</a>'
        );

        for (const a of Array.from(editor.querySelectorAll("a"))) labelAnchor(a);

        expect(editor.querySelector(`[${LINK_HOST_ATTRIBUTE}]`)).toBeNull();
    });

    it("reports no change when the label is already right", () => {
        const editor = editorWith('<a href="https://attacker.example/">x</a>');
        labelAnchor(anchor(editor));

        expect(labelAnchor(anchor(editor))).toBe(false);
    });

    it("updates the label when the href changes, and clears it when it becomes internal", () => {
        const editor = editorWith('<a href="https://one.example/">x</a>');
        const a = anchor(editor);
        labelAnchor(a);

        a.setAttribute("href", "https://two.example/");
        expect(labelAnchor(a)).toBe(true);
        expect(a.getAttribute(LINK_HOST_ATTRIBUTE)).toBe("two.example");

        a.setAttribute("href", `${window.location.origin}/inside`);
        expect(labelAnchor(a)).toBe(true);
        expect(a.hasAttribute(LINK_HOST_ATTRIBUTE)).toBe(false);
    });
});

describe("labelling a subtree", () => {
    it("labels only links inside an editor", () => {
        const inside = editorWith('<a href="https://in.example/">in</a>');
        const outside = document.createElement("div");
        outside.innerHTML = '<a href="https://out.example/">out</a>';
        document.body.appendChild(outside);

        const changed = labelExternalLinksIn(document.body);

        expect(changed).toBe(1);
        expect(anchor(inside).getAttribute(LINK_HOST_ATTRIBUTE)).toBe("in.example");
        expect(anchor(outside).hasAttribute(LINK_HOST_ATTRIBUTE)).toBe(false);
    });

    it("labels a link nested deep in a block", () => {
        const editor = editorWith(
            '<div class="bn-block"><div class="bn-inline-content"><b><a href="https://deep.example/">x</a></b></div></div>'
        );

        labelExternalLinksIn(editor);

        expect(anchor(editor).getAttribute(LINK_HOST_ATTRIBUTE)).toBe("deep.example");
    });

    it("labels an anchor passed as the root itself", () => {
        const editor = editorWith('<a href="https://self.example/">x</a>');

        labelExternalLinksIn(anchor(editor));

        expect(anchor(editor).getAttribute(LINK_HOST_ATTRIBUTE)).toBe("self.example");
    });

    it("counts only what it changed", () => {
        const editor = editorWith(
            '<a href="https://a.example/">a</a><a href="https://b.example/">b</a>'
        );

        expect(labelExternalLinksIn(editor)).toBe(2);
        expect(labelExternalLinksIn(editor)).toBe(0);
    });
});

describe("the observer", () => {
    let stop: () => void;

    beforeEach(() => {
        stop = () => {};
    });
    afterEach(() => stop());

    it("labels links already on the page when it starts", () => {
        const editor = editorWith('<a href="https://early.example/">x</a>');

        stop = startLabellingExternalLinks();

        expect(anchor(editor).getAttribute(LINK_HOST_ATTRIBUTE)).toBe("early.example");
    });

    it("labels a link that appears later (a note opened, a remote edit)", async () => {
        stop = startLabellingExternalLinks();

        const editor = editorWith('<a href="https://late.example/">x</a>');
        await settle();

        expect(anchor(editor).getAttribute(LINK_HOST_ATTRIBUTE)).toBe("late.example");
    });

    it("labels a link added to an editor that is already there", async () => {
        const editor = editorWith("<p>text</p>");
        stop = startLabellingExternalLinks();

        const p = editor.querySelector("p")!;
        p.innerHTML = '<a href="https://typed.example/">x</a>';
        await settle();

        expect(anchor(editor).getAttribute(LINK_HOST_ATTRIBUTE)).toBe("typed.example");
    });

    it("relabels a link whose href is edited in place", async () => {
        const editor = editorWith('<a href="https://one.example/">x</a>');
        stop = startLabellingExternalLinks();

        anchor(editor).setAttribute("href", "https://two.example/");
        await settle();

        expect(anchor(editor).getAttribute(LINK_HOST_ATTRIBUTE)).toBe("two.example");
    });

    it("leaves a link outside an editor alone", async () => {
        stop = startLabellingExternalLinks();

        const plain = document.createElement("a");
        plain.setAttribute("href", "https://sidebar.example/");
        document.body.appendChild(plain);
        await settle();

        expect(plain.hasAttribute(LINK_HOST_ATTRIBUTE)).toBe(false);
    });

    it("does one pass for a burst of changes, not one per change", async () => {
        const editor = editorWith("");
        stop = startLabellingExternalLinks();
        await settle();
        // Counted only from here, and only the observer's own frames: `settle`
        // itself waits on animation frames, so the spy is installed AFTER it.
        const raf = vi.spyOn(window, "requestAnimationFrame");

        for (let i = 0; i < 25; i += 1) {
            const a = document.createElement("a");
            a.setAttribute("href", `https://h${i}.example/`);
            editor.appendChild(a);
        }
        // Let the observer's microtask run and the frame it asked for fire,
        // without asking for any frame of our own while the spy is watching.
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const observerFrames = raf.mock.calls.length;
        raf.mockRestore();

        expect(observerFrames).toBe(1);
        expect(editor.querySelectorAll(`[${LINK_HOST_ATTRIBUTE}]`)).toHaveLength(25);
    });

    it("never throws, even with nothing to observe", () => {
        const noBody = { body: null } as unknown as Document;
        expect(() => startLabellingExternalLinks(noBody)).not.toThrow();
        expect(startLabellingExternalLinks(noBody)()).toBeUndefined();

        const original = globalThis.MutationObserver;
        // @ts-expect-error - simulating an environment without MutationObserver
        delete globalThis.MutationObserver;
        try {
            expect(() => startLabellingExternalLinks()).not.toThrow();
        } finally {
            globalThis.MutationObserver = original;
        }
    });

    it("never throws when observing fails", () => {
        const original = globalThis.MutationObserver;
        globalThis.MutationObserver = class {
            observe() {
                throw new Error("boom");
            }
            disconnect() {}
            takeRecords() {
                return [];
            }
        } as unknown as typeof MutationObserver;
        try {
            expect(() => startLabellingExternalLinks()).not.toThrow();
        } finally {
            globalThis.MutationObserver = original;
        }
    });

    it("stops when told to", async () => {
        stop = startLabellingExternalLinks();
        stop();

        const editor = editorWith('<a href="https://after.example/">x</a>');
        await settle();

        expect(anchor(editor).hasAttribute(LINK_HOST_ATTRIBUTE)).toBe(false);
    });
});

describe("the stylesheet that prints it", () => {
    const css = readFileSync(join(__dirname, "..", "App.css"), "utf8");

    it("prints the host after a labelled link inside an editor", () => {
        expect(css).toMatch(
            /\.bn-editor a\[data-link-host\]::after\s*\{[^}]*attr\(data-link-host\)/
        );
    });

    it("reads the attribute this module writes", () => {
        expect(LINK_HOST_ATTRIBUTE).toBe("data-link-host");
        expect(css).toContain(`[${LINK_HOST_ATTRIBUTE}]`);
    });
});
