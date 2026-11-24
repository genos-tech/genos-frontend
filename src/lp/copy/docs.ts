import type { Lang } from "../lpLang";

/**
 * The words AROUND the manual on /docs and /docs/<topic> (MIP-2331): page title, search box,
 * group names, buttons. The manual's own text (every topic, every heading, every setting) is not
 * here: it comes from `src/manual/manual.<lang>.json`, written once for the app guide, the help
 * tool and these pages (MIP-2321, MIP-2322). Keep this file to labels; a sentence that explains
 * how Genos works belongs in the manual source.
 *
 * `TODO(copy): MIP-2331` marks the wording Ken has to read before it is final.
 */

export type DocsGroupId = "use" | "teams" | "settings" | "connect";

export interface DocsCopy {
    title: string;
    /** TODO(copy): MIP-2331 */
    lead: string;
    searchLabel: string;
    searchPlaceholder: string;
    noMatch: string;
    /** `{n}` is the number of results. */
    resultsOne: string;
    resultsMany: string;
    settingTag: string;
    groups: Record<DocsGroupId | "more", string>;
    loading: string;
    loadError: string;
    retry: string;
    /** Shown on a Japanese page while the manual has no Japanese text yet. TODO(copy): MIP-2331 */
    notTranslated: string;
    backToDocs: string;
    onThisPage: string;
    topicsHeading: string;
    previous: string;
    next: string;
    other: { heading: string; links: Array<{ to: string; label: string }> };
}

export const DOCS_COPY: Record<Lang, DocsCopy> = {
    en: {
        title: "Docs",
        lead: "The Genos manual, for anyone who has not signed in yet. TODO(copy): MIP-2331",
        searchLabel: "Search the docs",
        searchPlaceholder: "Search: a setting, API key, export",
        noMatch: "Nothing matches. Try another word, or browse the topics below.",
        resultsOne: "1 result",
        resultsMany: "{n} results",
        settingTag: "Setting",
        groups: {
            use: "Using Genos",
            teams: "Teams and companies",
            settings: "Settings, plans and security",
            connect: "Connecting and fixing",
            more: "More",
        },
        loading: "Loading the manual…",
        loadError: "The manual could not be loaded.",
        retry: "Try again",
        notTranslated:
            "This topic is not available in Japanese yet. It is shown in English. TODO(copy): MIP-2331",
        backToDocs: "All docs",
        onThisPage: "On this page",
        topicsHeading: "Topics",
        previous: "Previous",
        next: "Next",
        other: {
            heading: "Other pages",
            links: [
                { to: "/features-guide", label: "Features guide" },
                { to: "/demo-guide", label: "Demo guide" },
                { to: "/developers", label: "Developers: REST API, MCP tools and webhooks" },
                { to: "/migrate", label: "Moving to Genos" },
                { to: "/support", label: "Support" },
            ],
        },
    },
    ja: {
        title: "ドキュメント",
        lead: "Genos のマニュアルです。まだサインインしていない方もお読みいただけます。 TODO(copy): MIP-2331",
        searchLabel: "ドキュメントを検索",
        searchPlaceholder: "検索：設定名、APIキー、エクスポート",
        noMatch: "一致する項目がありません。別の言葉で探すか、下のトピックをご覧ください。",
        resultsOne: "1件",
        resultsMany: "{n}件",
        settingTag: "設定",
        groups: {
            use: "Genos を使う",
            teams: "チームと会社",
            settings: "設定・プラン・セキュリティ",
            connect: "接続とトラブル対応",
            more: "その他",
        },
        loading: "マニュアルを読み込んでいます…",
        loadError: "マニュアルを読み込めませんでした。",
        retry: "もう一度試す",
        notTranslated:
            "このトピックの日本語版はまだありません。英語で表示しています。 TODO(copy): MIP-2331",
        backToDocs: "ドキュメント一覧",
        onThisPage: "このページの内容",
        topicsHeading: "トピック",
        previous: "前へ",
        next: "次へ",
        other: {
            heading: "関連ページ",
            links: [
                { to: "/features-guide", label: "機能ガイド" },
                { to: "/demo-guide", label: "デモの見方" },
                { to: "/developers", label: "開発者向け：REST API、MCP ツール、Webhook" },
                { to: "/migrate", label: "Genos への移行" },
                { to: "/support", label: "サポート" },
            ],
        },
    },
};

/**
 * Which hub group a topic is listed under. A topic missing here is listed under "More", so a
 * topic added to the manual shows up without anyone editing this table.
 */
export const DOCS_GROUPS: ReadonlyArray<{ id: DocsGroupId; topics: readonly string[] }> = [
    {
        id: "use",
        topics: [
            "basics",
            "chat",
            "tasks",
            "notes",
            "genos-ai",
            "searching",
            "notifications",
            "shortcuts",
            "tips",
        ],
    },
    {
        id: "teams",
        topics: ["teams", "cross-team", "company-setup", "company-organising", "playbooks"],
    },
    { id: "settings", topics: ["settings", "settings-reference", "plans", "security"] },
    { id: "connect", topics: ["connecting", "api-keys", "fixes"] },
];
