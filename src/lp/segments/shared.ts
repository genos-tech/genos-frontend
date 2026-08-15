import type { Lang } from "./types";

export const SHARED_NAV: Record<
    Lang,
    { home: string; contact: string; faq: string; plans: string; demo: string }
> = {
    ja: {
        home: "ホーム",
        contact: "お問い合わせ",
        faq: "よくある質問",
        plans: "料金",
        demo: "デモを見る",
    },
    en: {
        home: "Home",
        contact: "Contact",
        faq: "FAQ",
        plans: "Pricing",
        demo: "See the demo",
    },
};

export const SHARED_TRUST_STRIP: Record<Lang, string[]> = {
    ja: [
        "回答には、元の情報へ戻れるリンク",
        "AIによる書き込みは、実行前に必ず確認",
        "ログイン不要のデモ・クレジットカード不要",
    ],
    en: [
        "Answers link back to their sources",
        "AI writes only after you approve",
        "No-login demo and no credit card required",
    ],
};

export const AVAILABILITY_LABELS: Record<Lang, { availableNow: string; roadmap: string }> = {
    ja: {
        availableNow: "現在利用できます",
        roadmap: "ロードマップ — 現在は未提供",
    },
    en: {
        availableNow: "Available now",
        roadmap: "On the roadmap — not available today",
    },
};

export const DEFAULT_APPROVAL_STEPS: Record<Lang, string[]> = {
    ja: ["依頼する", "提案を確認する", "承認して実行する"],
    en: ["Ask", "Review the proposal", "Approve the change"],
};

export const SHARED_FOOTER: Record<Lang, { line: string; scopeNote: string }> = {
    ja: {
        line: "仕事・研究・学習の経緯をつなぐAIワークスペース。",
        scopeNote: "GenosはMVPとして公開中です。機能は継続的に改善しています。",
    },
    en: {
        line: "An AI workspace that keeps the history of work, research, and learning connected.",
        scopeNote: "Genos is live as an MVP and continues to improve through real user feedback.",
    },
};

const CONTACT_EMAIL = "genos.support@genosai.dev";

export function createSegmentMailtoHref(lang: Lang, mailtoTag: string): string {
    const subject = `${mailtoTag} ${lang === "ja" ? "パイロットについて相談したいです" : "Discussing a pilot"}`;

    const body =
        lang === "ja"
            ? [
                  "Genosチームへ",
                  "",
                  "パイロットについて相談したいです。",
                  "",
                  "【チーム/研究室の規模】",
                  "",
                  "",
                  "【現在使っているツール】",
                  "",
                  "",
                  "【試したいワークフロー】",
                  "",
                  "",
                  "【返信先メールアドレス】",
                  "",
                  "",
                  "よろしくお願いいたします。",
              ].join("\r\n")
            : [
                  "Hi Genos team,",
                  "",
                  "I'd like to discuss a pilot.",
                  "",
                  "Team / lab size:",
                  "",
                  "",
                  "Tools we currently use:",
                  "",
                  "",
                  "Workflow we'd like to try:",
                  "",
                  "",
                  "Reply email:",
                  "",
                  "",
                  "Thank you.",
              ].join("\r\n");

    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
