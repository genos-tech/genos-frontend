/**
 * The blog is picture first and says why a feature matters (MIP-2416): every post opens with a
 * screenshot or a diagram, has a flow and headed sections, runs about 300 to 600 words, and shows no
 * picture that is not in the repo.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { listBlogArticles } from "../lp/blog/blog";
import { BlogMarkdown } from "../lp/blog/BlogMarkdown";
import { pictureSize } from "../lp/blog/pictureSize";
import BlogPage from "../lp/BlogPage";

const publicFile = (path: string) => join(process.cwd(), "public", path);
const picturesIn = (body: string) =>
    [...body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);

/** The words a reader reads: not the picture's alt text or address. */
const words = (body: string) =>
    body
        .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
        .replace(/```flow|```|^- /gm, "")
        .split(/\s+/)
        .filter(Boolean).length;

describe("visual blog", () => {
    it.each(listBlogArticles().map((a) => [a.slug, a] as const))("%s", (_slug, article) => {
        expect(article.body).toMatch(/^(!\[[^\]]+\]\(\/lp\/|```flow\n)/);
        expect(words(article.body)).toBeGreaterThanOrEqual(300);
        expect(words(article.body)).toBeLessThanOrEqual(600);
        expect(article.body).toContain("```flow\n");
        expect(article.body).toMatch(/^## Why it is hard$/m);
        expect(article.body).toMatch(/^## How to start$/m);
        for (const src of picturesIn(article.body)) {
            expect(existsSync(publicFile(src)), src).toBe(true);
            expect(pictureSize(src).width, src).toBeGreaterThan(0);
        }
        if (article.cover) {
            expect(existsSync(publicFile(article.cover)), article.cover).toBe(true);
        } else {
            expect(article.coverFlow?.length).toBeGreaterThan(1);
        }
    });

    it("draws a flow block as a list of steps, not as code", () => {
        const { container } = render(<BlogMarkdown markdown={"```flow\nOne\nTwo\n```"} />);
        expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
            "One",
            "Two",
        ]);
        expect(container.querySelector("pre, code")).toBeNull();
    });

    it("keeps an ordinary code block as code", () => {
        const { container } = render(<BlogMarkdown markdown={"```\nplain\n```"} />);
        expect(container.querySelector("pre code")).not.toBeNull();
    });

    it("gives every card on the index a picture or a diagram", () => {
        const { container } = render(
            <MemoryRouter>
                <BlogPage />
            </MemoryRouter>
        );
        const cards = container.querySelectorAll(".lp-postgrid .lp-post");
        expect(cards.length).toBe(listBlogArticles().length);
        for (const card of cards) expect(card.querySelector(".lp-post__cover")).not.toBeNull();
    });
});
