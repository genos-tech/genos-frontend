import type { Dictionary } from "@blocknote/core";
import { ar, en, es, fr, ja, zh } from "@blocknote/core/locales";

import { useTranslation, type Locale } from "../../i18n";
import { diagramDictionaries, mathDictionaries } from "./blocks/mathDiagramDictionaries";

const blockNoteDictionaries: Record<Locale, Dictionary> = {
    ar,
    en,
    es,
    fr,
    hi: en,
    ja,
    zh,
};

/**
 * BlockNote does not currently ship a Hindi dictionary, so Hindi falls back
 * to its English catalog. Genos-owned placeholder copy remains app-localized.
 */
export const useBlockNoteDictionary = (): Dictionary => {
    const { locale, t } = useTranslation();
    const dictionary = blockNoteDictionaries[locale];

    // The math and diagram blocks' strings live under the keys the BlockNote packages use
    // (`dictionary.math`, `dictionary.diagram`); Hindi falls back to English.
    const blockStrings = {
        math: mathDictionaries[locale as keyof typeof mathDictionaries] ?? mathDictionaries.en,
        diagram:
            diagramDictionaries[locale as keyof typeof diagramDictionaries] ??
            diagramDictionaries.en,
    };

    return {
        ...dictionary,
        ...blockStrings,
        placeholders: {
            ...dictionary.placeholders,
            emptyDocument: t.common.editor.placeholderEmpty,
            default: t.common.editor.placeholderDefault,
            heading: t.common.editor.placeholderHeading,
        },
    };
};
