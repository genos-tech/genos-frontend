import { Fragment, ReactNode } from "react";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import { Box, Divider, Sheet, Stack, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import {
    cycleKeys,
    SHORTCUT_IDS,
    shortcutLabel,
    shortcutParts,
    SHORTCUTS,
    threadClickModifier,
    type ShortcutGroup,
    type ShortcutId,
} from "../../../shortcuts";
import { g } from "../../../theme/tokens";

/**
 * Tiny `<kbd>` chip. Joy doesn't ship one, so a native element keeps the
 * semantics for screen readers.
 */
const Kbd = ({ children }: { children: ReactNode }) => (
    <Box
        component="kbd"
        sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 22,
            px: 0.75,
            py: 0.1,
            fontFamily: g.font.mono,
            fontSize: "0.72rem",
            fontWeight: 600,
            lineHeight: 1.3,
            border: `1px solid ${g.border.default}`,
            borderRadius: g.radius.sm,
            bgcolor: g.bg.subtle,
            color: g.text.primary,
        }}
    >
        {children}
    </Box>
);

/** Settings groups, in the order they are listed. */
const GROUP_ORDER: readonly ShortcutGroup[] = ["global", "chat", "editing"];

/**
 * Settings → Shortcuts, generated from the shortcut registry: every entry
 * whose group is shown here is a row, so a shortcut that exists cannot be
 * missing from this page, and the platform text is the one the listener uses.
 */
export const KeyboardShortcutsSection = () => {
    const { t } = useTranslation();
    const copy = t.settings.shortcuts;

    // A chord prints its key caps; a gesture and a pointer entry compose theirs
    // from translated words around the platform's keys.
    const comboOf = (id: ShortcutId): string[] => {
        const kind = SHORTCUTS[id].kind;
        if (kind === "gesture") {
            const { hold } = cycleKeys();
            const words = copy.global.cycleCombo;
            return [fmt(words.hold, { key: hold }), words.tap, fmt(words.release, { key: hold })];
        }
        if (kind === "pointer") return [threadClickModifier(), copy.chat.clickMessage];
        return shortcutParts(id);
    };

    const groups = GROUP_ORDER.map((group) => ({
        group,
        title: copy[group].title,
        description: copy[group].description,
        rows: SHORTCUT_IDS.filter((id) => SHORTCUTS[id].group === group).map((id) => ({
            id,
            kind: SHORTCUTS[id].kind,
            label: shortcutLabel(id, t),
            combo: comboOf(id),
        })),
    }));

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <KeyboardRoundedIcon />
                <Typography level="title-md">{copy.heading}</Typography>
            </Stack>

            <Stack spacing={2}>
                {groups.map((group, gIdx) => (
                    <Box key={group.group} data-testid={`shortcut-group-${group.group}`}>
                        <Typography level="title-sm" sx={{ mt: gIdx === 0 ? 0.5 : 0 }}>
                            {group.title}
                        </Typography>
                        <Typography level="body-xs" sx={{ mb: 1 }}>
                            {group.description}
                        </Typography>
                        <Stack spacing={0.75}>
                            {group.rows.map((row, idx) => (
                                <Box key={row.id} data-shortcut-id={row.id}>
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        justifyContent="space-between"
                                        spacing={2}
                                    >
                                        <Typography level="body-sm">{row.label}</Typography>
                                        {/* Key caps read left to right in every language; a gesture or click row has translated words in it. */}
                                        <Stack
                                            alignItems="center"
                                            dir={row.kind === "chord" ? "ltr" : undefined}
                                            direction="row"
                                            spacing={0.5}
                                        >
                                            {row.combo.map((key, i) => (
                                                <Fragment key={`${key}-${i}`}>
                                                    <Kbd>{key}</Kbd>
                                                    {i < row.combo.length - 1 && (
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{ color: g.text.tertiary }}
                                                        >
                                                            +
                                                        </Typography>
                                                    )}
                                                </Fragment>
                                            ))}
                                        </Stack>
                                    </Stack>
                                    {idx < group.rows.length - 1 && <Divider sx={{ mt: 0.75 }} />}
                                </Box>
                            ))}
                        </Stack>
                    </Box>
                ))}
            </Stack>
        </Sheet>
    );
};
