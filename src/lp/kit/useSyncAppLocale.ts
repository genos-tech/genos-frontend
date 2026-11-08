import { useEffect, useRef } from "react";

import { useTranslation } from "../../i18n";
import type { Lang } from "../lpLang";

/**
 * The shell's language toggle drives the page; these pages read their copy from the app's own
 * catalogs (`useTranslation`), which pick a locale once when their provider mounts. This moves the
 * catalog when the visitor uses the toggle, and only then: on first render the catalog keeps the
 * locale it resolved itself, so a visitor on a French browser still reads French (the shell's
 * `Lang` is narrower than the app's `Locale` and would otherwise force English).
 */
export function useSyncAppLocale(lang: Lang) {
    const { locale, setLocale } = useTranslation();
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        if (locale !== lang) setLocale(lang);
        // `locale` is deliberately not a dependency: only a change of `lang` is a request.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang]);
}
