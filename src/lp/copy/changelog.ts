import type { Lang } from "../lpLang";

/**
 * Copy for `/changelog` (MIP-1257), ja + en: the page's own words and the
 * public roadmap. The dated entries are in `../changelog/entries.json`, each
 * tied to the merged PRs named in the PR body.
 *
 * The roadmap has NO dates. An item is `live` only if the site already says it
 * works; `coming` only if an existing page already says it is coming (ChatGPT:
 * the home and features copy say "coming soon"). Anything else is left out.
 *
 * TODO(copy): MIP-1257 — Ken reads the whole roadmap and the entries before the
 * page goes live. Each roadmap item traces to a Genos task or a shipped feature
 * (listed in the PR body).
 */

export type RoadmapStatus = "live" | "coming";

export interface RoadmapItem {
    status: RoadmapStatus;
    text: string;
}

export interface ChangelogCopy {
    title: string;
    lead: string;
    roadmapHeading: string;
    roadmapLead: string;
    statusLabel: Record<RoadmapStatus, string>;
    roadmap: RoadmapItem[];
    changelogHeading: string;
    changelogLead: string;
    rssLabel: string;
    rssHint: string;
    moreHeading: string;
    support: string;
    privacy: string;
}

export const CHANGELOG_COPY: Record<Lang, ChangelogCopy> = {
    en: {
        title: "Changelog",
        lead: "What changed in Genos, and what is coming next. Each entry is a change that is already live.",
        roadmapHeading: "Roadmap",
        roadmapLead: "What works today, and what is coming. We do not give dates here.",
        statusLabel: { live: "Live", coming: "Coming" },
        roadmap: [
            {
                status: "live",
                text: "Use Genos from claude.ai, Claude Desktop and Claude Code.",
            },
            {
                status: "live",
                text: "Tasks, notes, chat, projects and milestones in one workspace.",
            },
            {
                status: "live",
                text: "Connected AI apps: see which apps can use Genos, and disconnect them in Settings.",
            },
            {
                status: "live",
                text: "Teams, with a general chat and department chats.",
            },
            {
                status: "live",
                text: "Genos in your phone's browser, which you can add to the home screen.",
            },
            {
                status: "coming",
                text: "ChatGPT. Genos works with Claude today, and ChatGPT support is coming soon.",
            },
        ],
        changelogHeading: "Updates",
        changelogLead: "Newest first. Each date is the day the change went live.",
        rssLabel: "RSS feed",
        rssHint: "Subscribe to these updates in any feed reader.",
        moreHeading: "Other pages",
        support: "Support",
        privacy: "Privacy Policy",
    },
    ja: {
        title: "変更履歴",
        lead: "Genos で変わったこと、そして次に来るものをお知らせします。ここに載るのは、すでに公開された変更だけです。",
        roadmapHeading: "ロードマップ",
        roadmapLead: "今使えるものと、これから来るものです。ここには日付を載せていません。",
        statusLabel: { live: "利用可能", coming: "近日公開" },
        roadmap: [
            {
                status: "live",
                text: "claude.ai、Claude Desktop、Claude Code から Genos を使えます。",
            },
            {
                status: "live",
                text: "タスク、ノート、チャット、プロジェクト、マイルストーンを一つのワークスペースで扱えます。",
            },
            {
                status: "live",
                text: "接続した AI アプリ：Genos を使えるアプリを確認し、設定から接続を解除できます。",
            },
            {
                status: "live",
                text: "チーム。全体チャットと部署のチャットがあります。",
            },
            {
                status: "live",
                text: "スマートフォンのブラウザーで Genos を使えます。ホーム画面に追加することもできます。",
            },
            {
                status: "coming",
                text: "ChatGPT。現在は Claude に対応しています。ChatGPT への対応は近日公開予定です。",
            },
        ],
        changelogHeading: "アップデート",
        changelogLead: "新しいものから順に表示しています。日付は、変更が公開された日です。",
        rssLabel: "RSS フィード",
        rssHint: "RSS リーダーで、このアップデートを購読できます。",
        moreHeading: "関連ページ",
        support: "サポート",
        privacy: "プライバシーポリシー",
    },
};
