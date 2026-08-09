import type { Dictionary } from "@blocknote/core";
import { ar, en, es, fr, ja, zh } from "@blocknote/core/locales";

import { useTranslation, type Locale } from "../../i18n";

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

    return {
        ...dictionary,
        placeholders: {
            ...dictionary.placeholders,
            emptyDocument: t.common.editor.placeholderEmpty,
            default: t.common.editor.placeholderDefault,
            heading: t.common.editor.placeholderHeading,
        },
    };
};
