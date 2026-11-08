import type { Lang } from "./types";

/** Section labels shared by the four audience pages. */
export const SEGMENT_LABELS: Record<
    Lang,
    {
        questions: string;
        workflow: string;
        features: string;
        ai: string;
        now: string;
        coming: string;
        audience: string;
        comingBadge: string;
        askLabel: string;
    }
> = {
    ja: {
        questions: "こんな問いを、毎週繰り返していませんか",
        workflow: "仕事の流れ",
        features: "できること",
        ai: "Genosに聞く",
        now: "いま使えるもの",
        coming: "これから",
        audience: "こんな方に",
        comingBadge: "近日公開",
        askLabel: "質問の例",
    },
    en: {
        questions: "Questions you keep asking every week",
        workflow: "The flow of the work",
        features: "What you get",
        ai: "Ask Genos",
        now: "Works today",
        coming: "Coming",
        audience: "Made for",
        comingBadge: "Coming",
        askLabel: "Example questions",
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
