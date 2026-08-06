/**
 * Finding and repointing the relative image links in an imported note.
 *
 * A Notion page writes its images as percent-encoded paths next to the
 * markdown file. Getting this wrong is invisible until someone opens a
 * migrated page and finds a broken image, so the resolution rules are
 * pinned here rather than left to the importer's integration test.
 */

import { describe, expect, it } from "vitest";

import {
    collectRelativeAssetHrefs,
    isRelativeAssetHref,
    resolveAssetPath,
    rewriteAssetHrefs,
} from "../features/notes/common/services/noteAssetLinks";

const image = (url: string, extra: Record<string, unknown> = {}) => ({
    type: "image",
    props: { url, name: "shot.png", ...extra },
});

describe("isRelativeAssetHref", () => {
    it("accepts a path that could name a file in the picked folder", () => {
        expect(isRelativeAssetHref("Roadmap/shot.png")).toBe(true);
        expect(isRelativeAssetHref("./shot.png")).toBe(true);
        expect(isRelativeAssetHref("../shared/shot.png")).toBe(true);
    });

    it("rejects anything that already points somewhere real", () => {
        // Rewriting these would break links that work today.
        expect(isRelativeAssetHref("https://cdn.example.com/a.png")).toBe(false);
        expect(isRelativeAssetHref("data:image/png;base64,AAAA")).toBe(false);
        expect(isRelativeAssetHref("/media/notes/personal/1/a.png")).toBe(false);
        expect(isRelativeAssetHref("#anchor")).toBe(false);
        expect(isRelativeAssetHref("")).toBe(false);
        expect(isRelativeAssetHref(undefined)).toBe(false);
    });
});

describe("resolveAssetPath", () => {
    it("resolves against the directory the markdown lived in", () => {
        expect(resolveAssetPath("Projects", "Roadmap/shot.png")).toBe("Projects/Roadmap/shot.png");
    });

    it("decodes the percent-encoding Notion writes", () => {
        // The File list carries real names ("Roadmap abc"), the markdown
        // carries escaped ones — decoding is what makes them comparable.
        expect(resolveAssetPath("", "Roadmap%20abc/my%20shot.png")).toBe(
            "Roadmap abc/my shot.png"
        );
    });

    it("walks . and .. segments", () => {
        expect(resolveAssetPath("Projects/Q3", "../shared/shot.png")).toBe(
            "Projects/shared/shot.png"
        );
        expect(resolveAssetPath("Projects", "./shot.png")).toBe("Projects/shot.png");
    });

    it("drops a query or fragment, which address a rendition not a file", () => {
        expect(resolveAssetPath("", "shot.png?width=200")).toBe("shot.png");
        expect(resolveAssetPath("", "shot.png#top")).toBe("shot.png");
    });

    it("keeps a malformed escape rather than throwing", () => {
        // A single broken link should cost its own image, not the import.
        expect(resolveAssetPath("", "100%.png")).toBe("100%.png");
    });
});

describe("collectRelativeAssetHrefs", () => {
    it("finds media links at any depth, deduped", () => {
        const blocks = [
            image("a.png"),
            { type: "paragraph", content: [], children: [image("nested/b.png")] },
            { type: "file", props: { url: "c.pdf" } },
            image("a.png"),
        ];
        expect(collectRelativeAssetHrefs(blocks)).toEqual(["a.png", "nested/b.png", "c.pdf"]);
    });

    it("ignores links that are already absolute", () => {
        expect(collectRelativeAssetHrefs([image("https://cdn.example.com/a.png")])).toEqual([]);
    });

    it("ignores non-media blocks that happen to carry a url prop", () => {
        const blocks = [{ type: "paragraph", props: { url: "a.png" } }];
        expect(collectRelativeAssetHrefs(blocks)).toEqual([]);
    });
});

describe("rewriteAssetHrefs", () => {
    it("swaps in the uploaded URL and leaves everything else intact", () => {
        const blocks = [image("a.png", { previewWidth: 300 })];
        const out = rewriteAssetHrefs(blocks, new Map([["a.png", "https://api/media/a.png"]]));
        expect(out).toEqual([
            {
                type: "image",
                props: {
                    url: "https://api/media/a.png",
                    name: "shot.png",
                    previewWidth: 300,
                },
            },
        ]);
        // The input tree is not mutated — the caller still holds the
        // original body it wrote on create.
        expect((blocks[0] as { props: { url: string } }).props.url).toBe("a.png");
    });

    it("leaves a link alone when its upload didn't happen", () => {
        // A partial result still has to carry the images that did land.
        const out = rewriteAssetHrefs(
            [image("a.png"), image("b.png")],
            new Map([["a.png", "https://api/media/a.png"]])
        );
        expect(out.map((b) => (b as { props: { url: string } }).props.url)).toEqual([
            "https://api/media/a.png",
            "b.png",
        ]);
    });

    it("rewrites nested children too", () => {
        const out = rewriteAssetHrefs(
            [{ type: "paragraph", children: [image("a.png")] }],
            new Map([["a.png", "https://api/media/a.png"]])
        );
        const child = (out[0] as { children: { props: { url: string } }[] }).children[0];
        expect(child.props.url).toBe("https://api/media/a.png");
    });
});
