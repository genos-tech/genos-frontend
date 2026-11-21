import type { Locale } from "../../../i18n/types";
import shared from "./builtinTaskTemplates.json";

// The words of the built-in DEFAULT task template ("Standard task": the four headings and the
// grey hint lines) in every locale (MIP-1818, MIP-1894).
//
// They are READ from the vendored `builtinTaskTemplates.json` (the `default` template's
// `heading_i18n` and `i18n` maps next to the English `heading` and `text`), the same file
// genos-api pins by hash and recognises the prompts from. Before MIP-1894 the six translations
// lived here only, so the api did not know them and saved quick-created ja tasks kept their hints
// as content. One file, no drift.
//
// The create form must also recognise an untouched hint line written under ANY locale (a draft
// saved in ja and reopened in en, a language switched mid-form), and the catalogs are lazy
// chunks, so the words ship with the template and not with the catalogs.
// TODO(copy): the six non-English texts are DRAFT wording for a native reader.

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

type SharedItem = { text: string; i18n?: Partial<Record<Locale, string>> };
type SharedSection = {
    heading: string;
    heading_i18n?: Partial<Record<Locale, string>>;
    items: SharedItem[];
};

const DEFAULT_SECTIONS = (shared.templates.find((t) => t.id === "default")?.sections ??
    []) as SharedSection[];

/** The keys in the order the default template lists them (heading, then its lines, per section). */
export const DEFAULT_TEMPLATE_ORDER: DefaultTemplateTextKey[][] = [
    ["summaryHeading", "summaryHint"],
    ["motivationHeading", "motivationHint"],
    ["criteriaHeading", "criterion1", "criterion2", "criterion3"],
    ["notesHeading", "notesHint"],
];

const LOCALES: Locale[] = ["en", "ja", "zh", "es", "fr", "hi", "ar"];

const wordsFor = (locale: Locale): DefaultTemplateText => {
    const out: Partial<DefaultTemplateText> = {};
    DEFAULT_TEMPLATE_ORDER.forEach((keys, i) => {
        const sec = DEFAULT_SECTIONS[i];
        if (!sec) return;
        out[keys[0]] = locale === "en" ? sec.heading : (sec.heading_i18n?.[locale] ?? sec.heading);
        sec.items.forEach((item, j) => {
            const key = keys[j + 1];
            if (key) out[key] = locale === "en" ? item.text : (item.i18n?.[locale] ?? item.text);
        });
    });
    return out as DefaultTemplateText;
};

export const DEFAULT_TEMPLATE_TEXT = Object.fromEntries(
    LOCALES.map((l) => [l, wordsFor(l)])
) as Record<Locale, DefaultTemplateText>;
