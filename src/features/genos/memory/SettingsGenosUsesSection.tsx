import { useEffect, useState } from "react";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { Box, Button, Divider, Sheet, Stack, Typography } from "@mui/joy";

import { fmt, useTranslation, type Locale } from "../../../i18n";
import { authApi } from "../../../services/api";
import { detectBrowserTimezone } from "../../../utils/userTimezone";

const TIMEZONE_PREF_URL = "/user/preferences/timezone/";

interface Props {
    accessToken: string | null;
    // Takes the person to where the app language is edited. Only the main
    // Settings dialog can do that (it owns the tab state); the Genos
    // settings dialog can't open it, so it passes nothing and the section
    // names the path in words instead.
    onOpenLanguageSettings?: () => void;
}

// `settings.language.*` already carries each language's own name.
const LANGUAGE_NAME_KEY = {
    en: "english",
    ja: "japanese",
    es: "spanish",
    fr: "french",
    zh: "chinese",
    ar: "arabic",
    hi: "hindi",
} as const satisfies Record<Locale, string>;

/**
 * "Settings Genos uses": the two settings that shape how it answers, shown
 * with where they come from. It does not edit them — the editors already
 * exist (or deliberately don't), and a second copy here would drift.
 *
 * Time zone has NO editor to link to, and that is the honest state of the
 * product rather than an omission. What Genos reads is the account's
 * `timezone`, which the browser re-reports on every boot. The location on the
 * profile card is a different column that the agent does not read, so
 * pointing at it would promise a change that never happens. The row says
 * where the value comes from and how to change it (the device) instead.
 */
export const SettingsGenosUsesSection = ({ accessToken, onOpenLanguageSettings }: Props) => {
    const { t, locale } = useTranslation();
    const m = t.settings.genosMemory.settingsUsed;
    // What this browser will report is the best guess until the server's own
    // value arrives, and the fallback if that request fails.
    const [zone, setZone] = useState<string | null>(() => detectBrowserTimezone());

    useEffect(() => {
        const api = authApi(accessToken);
        if (!api) return;
        let cancelled = false;
        void (async () => {
            try {
                const res = await api.get<{ timezone?: string }>(TIMEZONE_PREF_URL, {
                    suppressErrorToast: true,
                });
                if (!cancelled && res.data?.timezone) setZone(res.data.timezone);
            } catch {
                /* keep the browser's zone */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg", minWidth: 0 }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <TuneRoundedIcon />
                <Typography level="title-md" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {m.heading}
                </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {m.description}
            </Typography>

            <Box sx={{ minWidth: 0 }}>
                <Typography level="title-sm">{m.timezoneLabel}</Typography>
                <Typography level="body-sm" sx={{ fontWeight: 500, overflowWrap: "anywhere" }}>
                    {zone ?? m.timezoneUnknown}
                </Typography>
                <Typography level="body-xs">{m.timezoneHelper}</Typography>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            <Box sx={{ minWidth: 0 }}>
                <Typography level="title-sm">{m.languageLabel}</Typography>
                <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                    {t.settings.language[LANGUAGE_NAME_KEY[locale]]}
                </Typography>
                <Typography level="body-xs">{m.languageHelper}</Typography>
                {onOpenLanguageSettings ? (
                    <Button
                        size="sm"
                        sx={{ mt: 1 }}
                        variant="outlined"
                        onClick={onOpenLanguageSettings}
                    >
                        {m.changeLanguage}
                    </Button>
                ) : (
                    <Typography level="body-xs" sx={{ mt: 0.5 }}>
                        {fmt(m.languagePath, {
                            settings: t.settings.title,
                            tab: t.settings.tabs.general,
                            section: t.settings.language.heading,
                        })}
                    </Typography>
                )}
            </Box>
        </Sheet>
    );
};
