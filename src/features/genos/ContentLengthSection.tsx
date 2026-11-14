import { useId } from "react";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import { Box, Radio, RadioGroup, Sheet, Stack, Typography } from "@mui/joy";

import { ErrorState } from "../../components/ui/feedback/ErrorState";
import { toast } from "../../components/ui/feedback/toastStore";
import { SettingRow } from "../../components/ui/settings/SettingRow";
import {
    CONTENT_LENGTHS,
    ContentLength,
    useContentLengthPreference,
} from "../../hooks/common/useContentLengthPreference";
import { useTranslation } from "../../i18n";

/**
 * Settings -> Genos -> "How much Genos writes" (MIP-1540): Short / Standard / Long, saved when
 * picked. It sets how long the bodies of the tasks, milestones and notes Genos writes are, and
 * the plans it proposes; chat answers stay concise at every level, and the helper says so.
 *
 * Self-contained like `SpotlightSection` (reads its own preference), so both Genos settings
 * surfaces mount it with no props. Each option is a `SettingRow` with a real radio at the end;
 * the text is that radio's `<label>`, so a click or tap on it picks the option.
 */
export const ContentLengthSection = () => {
    const { t } = useTranslation();
    const s = t.settings.contentLength;
    const { value, status, setValue, reload } = useContentLengthPreference();
    const headingId = useId();
    const idBase = useId();

    const labels: Record<ContentLength, { title: string; helper: string }> = {
        short: { title: s.shortLabel, helper: s.shortHelper },
        standard: { title: s.standardLabel, helper: s.standardHelper },
        long: { title: s.longLabel, helper: s.longHelper },
    };

    const choose = async (next: ContentLength) => {
        const ok = await setValue(next);
        if (!ok) toast.error(s.saveFailed, { id: "content-length-save" });
    };

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg", minWidth: 0 }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <NotesRoundedIcon />
                <Typography
                    id={headingId}
                    level="title-md"
                    sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                >
                    {s.heading}
                </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {s.description}
            </Typography>

            {status === "error" ? (
                <ErrorState
                    data-error="content-length"
                    size="xs"
                    title={s.loadFailed}
                    onRetry={reload}
                />
            ) : (
                <RadioGroup
                    aria-busy={status === "loading"}
                    aria-labelledby={headingId}
                    name={`${idBase}-content-length`}
                    sx={{ gap: 0.5, minWidth: 0 }}
                    value={value ?? ""}
                    onChange={(event) => {
                        const next = event.target.value;
                        if ((CONTENT_LENGTHS as readonly string[]).includes(next)) {
                            void choose(next as ContentLength);
                        }
                    }}
                >
                    {CONTENT_LENGTHS.map((level) => {
                        const inputId = `${idBase}-${level}`;
                        return (
                            <SettingRow
                                key={level}
                                alignItems="center"
                                direction="row"
                                disabled={status === "loading"}
                                justifyContent="space-between"
                                spacing={2}
                            >
                                <Box
                                    component="label"
                                    htmlFor={inputId}
                                    sx={{
                                        minWidth: 0,
                                        flex: 1,
                                        display: "block",
                                        cursor: status === "loading" ? "default" : "pointer",
                                    }}
                                >
                                    <Typography
                                        component="span"
                                        display="block"
                                        id={`${inputId}-title`}
                                        level="title-sm"
                                    >
                                        {labels[level].title}
                                    </Typography>
                                    <Typography
                                        component="span"
                                        display="block"
                                        id={`${inputId}-helper`}
                                        level="body-xs"
                                    >
                                        {labels[level].helper}
                                    </Typography>
                                </Box>
                                <Radio
                                    disabled={status === "loading"}
                                    slotProps={{
                                        input: {
                                            id: inputId,
                                            "aria-labelledby": `${inputId}-title`,
                                            "aria-describedby": `${inputId}-helper`,
                                        },
                                    }}
                                    value={level}
                                />
                            </SettingRow>
                        );
                    })}
                </RadioGroup>
            )}
        </Sheet>
    );
};
