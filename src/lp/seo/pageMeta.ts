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

export const SECURITY_META: Record<SeoLang, Meta> = {
    ja: {
        title: "セキュリティとデータの扱い | Genos",
        description:
            "データの保存場所、暗号化、サインイン、アクセス権、アカウント削除、報告の方法を、現在の仕組みに基づいて説明します。",
    },
    en: {
        title: "Security and data handling | Genos",
        description:
            "Where Genos keeps your data, how it is encrypted, how sign-in and access work, what account deletion removes, and how to report a problem.",
    },
};

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
