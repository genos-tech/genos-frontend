import type { SeoLang } from "./head";

/**
 * Titles and descriptions for the public pages that carry no copy of their own
 * to take them from (the home, audience, features, demo and plans pages keep
 * theirs next to the page).
 *
 * Every line states what the page IS, taken from the page itself. Nothing here
 * is a claim about the product that the page does not already make, and no
 * headline wording: that is decided on the home page, not here.
 */

type Meta = { title: string; description: string };

export const SUPPORT_META: Record<SeoLang, Meta> = {
    ja: {
        title: "サポート | Genos",
        description:
            "Genosのサポートへのメールでの連絡方法、お知らせいただきたい内容、連携したAIアプリの接続解除の手順。",
    },
    en: {
        title: "Support | Genos",
        description:
            "How to reach Genos support by email, what to include, and how to disconnect a connected AI app.",
    },
};

/** MIP-1257: dated updates, the public roadmap and the RSS feed. */
export const CHANGELOG_META: Record<SeoLang, Meta> = {
    ja: {
        title: "変更履歴 | Genos",
        description:
            "Genos の最近の変更、ロードマップ（利用可能なものと近日公開のもの）、RSS フィード。",
    },
    en: {
        title: "Changelog | Genos",
        description:
            "Recent changes to Genos, a roadmap of what works today and what is coming, and an RSS feed.",
    },
};

/** MIP-1265: what Genos does for accessibility and which browsers and devices it supports. */
export const ACCESSIBILITY_META: Record<SeoLang, Meta> = {
    ja: {
        title: "アクセシビリティ | Genos",
        description:
            "Genos のアクセシビリティの取り組み、まだできていないこと、対応しているブラウザーと端末。",
    },
    en: {
        title: "Accessibility | Genos",
        description:
            "What Genos does for accessibility, what is not done yet, and which browsers and devices Genos supports.",
    },
};

/** Moving into Genos (MIP-1260): says what can be imported and what cannot, nothing more. */
export const MIGRATE_META: Record<SeoLang, Meta> = {
    ja: {
        title: "Genosへの移行 | Genos",
        description:
            "Markdown のノートの取り込み、タスクの作り方、今は取り込めないもの（Slack、Notion、Jira、Google ドキュメント）。",
    },
    en: {
        title: "Moving to Genos | Genos",
        description:
            "Importing Markdown notes into Genos, creating tasks, and what has no import yet: Slack, Notion, Jira and Google Docs.",
    },
};

/** English-only reference. */
export const DEVELOPERS_META: Meta = {
    title: "Developers | Genos",
    description:
        "Genos developer reference: the REST API, MCP tools, outbound webhooks and the realtime event stream.",
};

/** English-only index. */
export const BLOG_META: Meta = {
    title: "Blog | Genos",
    description: "Product thinking and engineering write-ups from the Genos team.",
};

/** One URL carries both languages; Japanese is the operative text. */
export const PRIVACY_META: Meta = {
    title: "プライバシーポリシー | Privacy Policy | Genos",
    description:
        "Genosのプライバシーポリシー(日本語が正文、英語の要約つき)。 Privacy policy for Genos: the Japanese text is operative, with an English summary.",
};

export const LEGAL_META: Meta = {
    title: "特定商取引法に基づく表記 | Legal disclosure | Genos",
    description:
        "特定商取引法に基づく表記と、解約・返金のご案内(英語の要約つき)。 Disclosure under Japan's Specified Commercial Transactions Act, with an English summary.",
};

/** A blog article's own title and excerpt are its meta. */
export const articleMeta = (article: { title: string; excerpt: string }): Meta => ({
    title: `${article.title} | Genos`,
    description: article.excerpt,
});
