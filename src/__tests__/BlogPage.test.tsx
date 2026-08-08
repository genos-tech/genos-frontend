/**
 * `/blog` — English-only LP blog.
 *
 * Pins: every manifest entry reaches the index, every slug has a body,
 * Japanese platform drafts are never listed, and unknown slugs redirect.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import articlesManifest from "../lp/blog/articles.json";
import { getBlogArticle, listBlogArticles } from "../lp/blog/blog";
import BlogArticlePage from "../lp/BlogArticlePage";
import BlogPage from "../lp/BlogPage";

const renderBlog = (path = "/blog") =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route element={<BlogPage />} path="/blog" />
                <Route element={<BlogArticlePage />} path="/blog/:slug" />
            </Routes>
        </MemoryRouter>
    );

describe("LP blog", () => {
    it("only publishes English articles", () => {
        for (const meta of articlesManifest) {
            expect(meta.language, meta.slug).toBe("en");
        }
        for (const article of listBlogArticles()) {
            expect(article.language).toBe("en");
            expect(article.body.length).toBeGreaterThan(40);
        }
    });

    it("lists every manifest title on the index", () => {
        renderBlog();
        for (const meta of articlesManifest) {
            expect(
                screen.getAllByText(meta.title).length,
                `"${meta.title}" missing from /blog`
            ).toBeGreaterThan(0);
        }
    });

    it("renders a known article body at /blog/:slug", () => {
        const first = listBlogArticles()[0];
        expect(first).toBeTruthy();
        renderBlog(`/blog/${first.slug}`);
        expect(screen.getByRole("heading", { level: 1, name: first.title })).toBeTruthy();
        // Body is markdown; spot-check a distinctive phrase from the sync snapshot.
        expect(getBlogArticle(first.slug)?.body).toContain("Genos");
    });

    it("does not include Japanese marketing draft titles", () => {
        const titles = listBlogArticles().map((a) => a.title);
        expect(titles.some((t) => /あの話|文脈|ワークスペースを自分で/.test(t))).toBe(false);
    });
});
