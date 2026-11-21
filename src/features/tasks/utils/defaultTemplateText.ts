import type { Locale } from "../../../i18n/types";

// The words of the built-in DEFAULT task template ("Standard task": the four headings and the
// grey hint lines) in every locale (MIP-1818).
//
// Why not the locale catalogs: the template's English source is the vendored
// `builtinTaskTemplates.json` (pinned by hash against genos-api, which the agent reads), so it
// stays. The create form must also recognise an untouched hint line written under ANY locale
// (a draft saved in ja and reopened in en, a language switched mid-form), and the catalogs are
// lazy chunks; ten short strings per locale are cheaper to ship than every catalog.
//
// The en strings are pinned equal to the JSON by `defaultTemplateLocalizedMIP1818.test.ts`.
// The other six are DRAFT wording for a native reader.

export type DefaultTemplateTextKey =
    | "summaryHeading"
    | "summaryHint"
    | "motivationHeading"
    | "motivationHint"
    | "criteriaHeading"
    | "criterion1"
    | "criterion2"
    | "criterion3"
    | "notesHeading"
    | "notesHint";

export type DefaultTemplateText = Record<DefaultTemplateTextKey, string>;

export const DEFAULT_TEMPLATE_TEXT: Record<Locale, DefaultTemplateText> = {
    en: {
        summaryHeading: "🧾 Summary",
        summaryHint: "One or two lines on what this task delivers.",
        motivationHeading: "🪜 Motivation",
        motivationHint: "Why does this matter? What problem are we solving?",
        criteriaHeading: "✅ Acceptance criteria",
        criterion1: "First condition that must be true when this is done.",
        criterion2: "Second condition…",
        criterion3: "Third condition…",
        notesHeading: "🎯 Notes & links",
        notesHint: "Anything else worth pinning here.",
    },
    // TODO(copy): MIP-1818 draft wording for a native reader (all six non-English locales).
    ja: {
        summaryHeading: "🧾 概要",
        summaryHint: "このタスクで何を届けるのかを1〜2行で。",
        motivationHeading: "🪜 背景",
        motivationHint: "なぜ重要なのか。どんな課題を解決するのか？",
        criteriaHeading: "✅ 受け入れ条件",
        criterion1: "完了時に満たすべき1つ目の条件。",
        criterion2: "2つ目の条件…",
        criterion3: "3つ目の条件…",
        notesHeading: "🎯 メモとリンク",
        notesHint: "ここに残しておきたいその他の情報。",
    },
    zh: {
        summaryHeading: "🧾 概述",
        summaryHint: "用一两句话说明此任务要交付什么。",
        motivationHeading: "🪜 背景",
        motivationHint: "为什么这很重要？我们要解决什么问题？",
        criteriaHeading: "✅ 验收标准",
        criterion1: "完成时必须满足的第一个条件。",
        criterion2: "第二个条件…",
        criterion3: "第三个条件…",
        notesHeading: "🎯 备注与链接",
        notesHint: "其他值得在此记录的内容。",
    },
    es: {
        summaryHeading: "🧾 Resumen",
        summaryHint: "Una o dos líneas sobre lo que entrega esta tarea.",
        motivationHeading: "🪜 Motivación",
        motivationHint: "¿Por qué importa? ¿Qué problema resolvemos?",
        criteriaHeading: "✅ Criterios de aceptación",
        criterion1: "Primera condición que debe cumplirse al terminar.",
        criterion2: "Segunda condición…",
        criterion3: "Tercera condición…",
        notesHeading: "🎯 Notas y enlaces",
        notesHint: "Cualquier otra cosa que valga la pena anotar aquí.",
    },
    fr: {
        summaryHeading: "🧾 Résumé",
        summaryHint: "Une ou deux lignes sur ce que livre cette tâche.",
        motivationHeading: "🪜 Contexte",
        motivationHint: "Pourquoi est-ce important ? Quel problème résolvons-nous ?",
        criteriaHeading: "✅ Critères d’acceptation",
        criterion1: "Première condition à remplir une fois la tâche terminée.",
        criterion2: "Deuxième condition…",
        criterion3: "Troisième condition…",
        notesHeading: "🎯 Notes et liens",
        notesHint: "Tout ce qui mérite d’être noté ici.",
    },
    hi: {
        summaryHeading: "🧾 सारांश",
        summaryHint: "यह टास्क क्या देता है, इसे एक-दो पंक्तियों में लिखें।",
        motivationHeading: "🪜 प्रेरणा",
        motivationHint: "यह क्यों मायने रखता है? हम कौन-सी समस्या हल कर रहे हैं?",
        criteriaHeading: "✅ स्वीकृति मानदंड",
        criterion1: "पूरा होने पर जो पहली शर्त सही होनी चाहिए।",
        criterion2: "दूसरी शर्त…",
        criterion3: "तीसरी शर्त…",
        notesHeading: "🎯 नोट्स और लिंक",
        notesHint: "यहाँ रखने लायक कोई और बात।",
    },
    ar: {
        summaryHeading: "🧾 ملخص",
        summaryHint: "سطر أو سطران عمّا ستقدّمه هذه المهمة.",
        motivationHeading: "🪜 الدافع",
        motivationHint: "لماذا يهم هذا؟ ما المشكلة التي نحلّها؟",
        criteriaHeading: "✅ معايير القبول",
        criterion1: "الشرط الأول الذي يجب تحققه عند الانتهاء.",
        criterion2: "الشرط الثاني…",
        criterion3: "الشرط الثالث…",
        notesHeading: "🎯 ملاحظات وروابط",
        notesHint: "أي شيء آخر يستحق التثبيت هنا.",
    },
};

/** The keys in the order the default template lists them (heading, then its lines, per section). */
export const DEFAULT_TEMPLATE_ORDER: DefaultTemplateTextKey[][] = [
    ["summaryHeading", "summaryHint"],
    ["motivationHeading", "motivationHint"],
    ["criteriaHeading", "criterion1", "criterion2", "criterion3"],
    ["notesHeading", "notesHint"],
];
