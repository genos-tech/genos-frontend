/**
 * What a colleague is allowed to put on their profile card.
 *
 * The renderer's whole job is subtraction, so the tests are mostly about
 * what ISN'T there. Each disallowed construct has a specific reason and
 * a specific fallback, and the fallback matters as much as the block:
 * someone who pastes a heading should see their words, not lose them.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileMarkdown } from "../components/ui/misc/ProfileMarkdown";

const renderMd = (text: string) => render(<ProfileMarkdown isDark={false} text={text} />);

describe("ProfileMarkdown — the sentence-level grammar it keeps", () => {
    it("renders emphasis", () => {
        const { container } = renderMd("Runs on **coffee** and _naps_.");
        expect(container.querySelector("strong")?.textContent).toBe("coffee");
        expect(container.querySelector("em")?.textContent).toBe("naps");
    });

    it("renders lists", () => {
        const { container } = renderMd("- one\n- two");
        expect(container.querySelectorAll("li")).toHaveLength(2);
    });

    it("renders inline code", () => {
        const { container } = renderMd("I live in `vim`.");
        expect(container.querySelector("code")?.textContent).toBe("vim");
    });

    it("renders GFM strikethrough, so remark-gfm is actually wired up", () => {
        const { container } = renderMd("~~manager~~ engineer");
        expect(container.querySelector("del")?.textContent).toBe("manager");
    });
});

describe("ProfileMarkdown — the block grammar it removes", () => {
    it("turns headings into paragraphs instead of shrinking them", () => {
        // A profile card is a fixed slot in a shared layout. Styling a
        // heading down just invites the next size up.
        const { container } = renderMd("# SHOUTING");
        expect(container.querySelector("h1")).toBeNull();
        expect(screen.getByText("SHOUTING").tagName).toBe("P");
    });

    it("keeps the words when it drops the heading", () => {
        renderMd("### Staff Engineer");
        expect(screen.getByText("Staff Engineer")).toBeInTheDocument();
    });

    it("drops images entirely", () => {
        // Not a sizing problem. Every colleague who opens this profile
        // would make a request to a host the author chose.
        const { container } = renderMd("![tracker](https://evil.example/pixel.png)");
        expect(container.querySelector("img")).toBeNull();
    });

    it("unwraps blockquotes and code fences to their text", () => {
        const { container } = renderMd("> quoted\n\n```\nfenced\n```");
        expect(container.querySelector("blockquote")).toBeNull();
        expect(container.querySelector("pre")).toBeNull();
        expect(container.textContent).toContain("quoted");
        expect(container.textContent).toContain("fenced");
    });

    it("drops horizontal rules", () => {
        const { container } = renderMd("above\n\n---\n\nbelow");
        expect(container.querySelector("hr")).toBeNull();
    });

    it("flattens tables rather than laying them out", () => {
        const { container } = renderMd("| a | b |\n| - | - |\n| 1 | 2 |");
        expect(container.querySelector("table")).toBeNull();
    });

    it("does not render raw HTML", () => {
        // react-markdown needs rehype-raw to render HTML and we don't
        // pass it; this pins that we never start.
        const { container } = renderMd('<img src="x" onerror="alert(1)">');
        expect(container.querySelector("img")).toBeNull();
    });
});

describe("ProfileMarkdown — links", () => {
    it("opens external links in a new tab with a safe rel", () => {
        const { container } = renderMd("[my site](https://example.com)");
        const anchor = container.querySelector("a");
        expect(anchor?.getAttribute("href")).toBe("https://example.com");
        expect(anchor?.getAttribute("target")).toBe("_blank");
        // `noopener` stops the opened page reaching back through
        // `window.opener`; `ugc` marks it as what it is.
        expect(anchor?.getAttribute("rel")).toContain("noopener");
        expect(anchor?.getAttribute("rel")).toContain("ugc");
    });

    it("renders a javascript: URL as plain text, not a link", () => {
        // `defaultUrlTransform` blanks the href; without the fallback
        // that becomes an anchor pointing at the current page, which
        // looks live and isn't.
        const { container } = renderMd("[click me](javascript:alert(1))");
        expect(container.querySelector("a")).toBeNull();
        expect(container.textContent).toContain("click me");
    });
});
