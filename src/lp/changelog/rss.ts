import { SITE_ORIGIN } from "../seo/routes";
import type { ChangelogEntry } from "./changelog";

/**
 * `changelog.rss`, written at build time by `scripts/lpSeo.ts` from the same
 * entries the page shows. English only, because feed readers show one language;
 * the Japanese text stays on the page. Pure, so the build (Node) and the tests
 * use the same code.
 */

const escapeXml = (s: string): string =>
    s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

/** Absolute URL of the changelog page; the RSS channel and every item link to it. */
export const CHANGELOG_URL = `${SITE_ORIGIN}/changelog`;

/** Route of the RSS feed, served from the build output as a static file. */
export const CHANGELOG_RSS_PATH = "/changelog.rss";

/** RFC 822 date at 00:00 UTC, which is what RSS readers expect. */
const rfc822 = (ymd: string): string => new Date(`${ymd}T00:00:00Z`).toUTCString();

export const buildChangelogRss = (entries: readonly ChangelogEntry[]): string => {
    const items = entries.map((e) => {
        const link = `${CHANGELOG_URL}#${e.id}`;
        return [
            "    <item>",
            `      <title>${escapeXml(e.en.title)}</title>`,
            `      <link>${escapeXml(link)}</link>`,
            `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
            `      <pubDate>${rfc822(e.date)}</pubDate>`,
            `      <description>${escapeXml(e.en.body)}</description>`,
            "    </item>",
        ].join("\n");
    });
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0">',
        "  <channel>",
        "    <title>Genos changelog</title>",
        `    <link>${escapeXml(CHANGELOG_URL)}</link>`,
        "    <description>What changed in Genos, newest first.</description>",
        "    <language>en</language>",
        ...items,
        "  </channel>",
        "</rss>",
        "",
    ].join("\n");
};
