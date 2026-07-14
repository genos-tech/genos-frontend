import { describe, expect, it } from "vitest";

import { brandColor, resolveLinkBrand } from "../features/tasks/utils/linkBrandIcons";

const titleFor = (url: string) => resolveLinkBrand(url)?.title ?? null;
const brandFor = (url: string) => {
    const b = resolveLinkBrand(url);
    if (!b) throw new Error(`no brand for ${url}`);
    return b;
};

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

describe("brandColor", () => {
    it("keeps a high-contrast brand color in both themes", () => {
        const yt = brandFor("https://youtube.com/watch?v=x"); // #FF0000
        expect(brandColor(yt, false)).toBe(yt.color);
        expect(brandColor(yt, true)).toBe(yt.color);
    });

    it("adjusts a near-black brand for dark mode but keeps it in light mode", () => {
        const gh = brandFor("https://github.com/x"); // #181717
        expect(brandColor(gh, false)).toBe(gh.color); // dark-on-light: fine as-is
        const dark = brandColor(gh, true); // would vanish on a dark bg
        expect(dark).not.toBe(gh.color);
        expect(dark).toMatch(/^rgb\(/);
    });

    it("adjusts a near-white brand for light mode but keeps it in dark mode", () => {
        const gb = brandFor("https://acme.gitbook.io/docs"); // #BBDDE5
        expect(brandColor(gb, true)).toBe(gb.color); // light-on-dark: fine as-is
        const light = brandColor(gb, false); // would vanish on a white bg
        expect(light).not.toBe(gb.color);
        expect(light).toMatch(/^rgb\(/);
    });
});
