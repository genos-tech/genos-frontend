import { describe, expect, it } from "vitest";

import { resolveLinkBrand } from "../features/tasks/utils/linkBrandIcons";

const titleFor = (url: string) => resolveLinkBrand(url)?.title ?? null;

describe("resolveLinkBrand", () => {
    it("matches known hosts regardless of path/query", () => {
        expect(titleFor("https://github.com/genos-tech/genos-frontend/pull/1")).toBe("GitHub");
        expect(titleFor("https://figma.com/file/abc?node-id=1")).toBe("Figma");
        expect(titleFor("https://notion.so/Some-Page-123")).toBe("Notion");
    });

    it("strips a leading www.", () => {
        expect(titleFor("https://www.notion.so/x")).toBe("Notion");
        expect(titleFor("https://www.youtube.com/watch?v=abc")).toBe("YouTube");
    });

    it("resolves subdomains via suffix match", () => {
        expect(titleFor("https://app.slack.com/client/T000/C000")).toBe("Slack");
        expect(titleFor("https://acme.atlassian.net/browse/GEN-42")).toBe("Jira");
    });

    it("disambiguates Google Docs vs Sheets by path", () => {
        expect(titleFor("https://docs.google.com/document/d/abc/edit")).toBe("Google Docs");
        expect(titleFor("https://docs.google.com/spreadsheets/d/abc/edit")).toBe("Google Sheets");
        expect(titleFor("https://drive.google.com/file/d/abc/view")).toBe("Google Drive");
    });

    it("follows cross-domain aliases", () => {
        expect(titleFor("https://youtu.be/abc")).toBe("YouTube");
        expect(titleFor("https://twitter.com/someone")).toBe("X");
        expect(titleFor("https://discord.gg/invite")).toBe("Discord");
    });

    it("returns null for unknown hosts and invalid input", () => {
        expect(resolveLinkBrand("https://example.com/whatever")).toBeNull();
        // A host that merely contains a known domain as a substring must
        // not match (suffix guard requires a dot boundary).
        expect(resolveLinkBrand("https://notgithub.com/x")).toBeNull();
        expect(resolveLinkBrand("not a url")).toBeNull();
    });

    it("exposes a non-empty SVG path for matched brands", () => {
        const brand = resolveLinkBrand("https://slack.com");
        expect(brand?.title).toBe("Slack");
        expect(brand?.path.startsWith("M")).toBe(true);
    });
});
