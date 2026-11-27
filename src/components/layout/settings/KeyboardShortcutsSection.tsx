import { Fragment, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import { Box, Button, Chip, Divider, IconButton, Sheet, Stack, Typography } from "@mui/joy";

import { useUiSettings } from "../../../hooks/common/uiSettingsState";
import { fmt, useTranslation } from "../../../i18n";
import {
    chordParts,
    currentPlatform,
    customChord,
    cycleKeys,
    defaultShortcutParts,
    findConflict,
    findResetConflict,
    getOverrides,
    readRecorded,
    serializeOverrides,
    setRecording,
    SHORTCUT_IDS,
    SHORTCUT_SETTINGS_KEYS,
    shortcutLabel,
    shortcutParts,
    SHORTCUTS,
    threadClickModifier,
    useShortcutsVersion,
    type Chord,
    type Overrides,
    type ShortcutGroup,
    type ShortcutId,
} from "../../../shortcuts";
import { g } from "../../../theme/tokens";
import { visuallyHidden } from "../../ui/a11y/visuallyHidden";
import { AppTooltip } from "../../ui/AppTooltip";
import { TOUCH_TARGET } from "../../ui/touchTargets";

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

/** The caps of one shortcut. They read left to right in every language when `ltr`. */
const Caps = ({ combo, ltr }: { combo: string[]; ltr: boolean }) => (
    <Stack alignItems="center" dir={ltr ? "ltr" : undefined} direction="row" spacing={0.5}>
        {combo.map((key, i) => (
            <Fragment key={`${key}-${i}`}>
                <Kbd>{key}</Kbd>
                {i < combo.length - 1 && (
                    <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
                        +
                    </Typography>
                )}
            </Fragment>
        ))}
    </Stack>
);

/** Settings groups, in the order they are listed. */
const GROUP_ORDER: readonly ShortcutGroup[] = [
    "global",
    "chat",
    "editing",
    "table",
    "board",
    "calendar",
];

/** Keys dropped into a translated sentence keep their left-to-right order (Arabic). */
const isolate = (keys: string) => `⁦${keys}⁩`;

/**
 * Settings → Shortcuts, generated from the shortcut registry: every entry
 * whose group is shown here is a row, so a shortcut that exists cannot be
 * missing from this page, and the platform text is the one the listener uses.
 *
 * A `rebindable` row's keys are a button (MIP-2413): press it, then the new keys.
 * The change is saved to the account's `ui_settings`; `ShortcutOverridesBridge`
 * hands it to the listeners.
 */
export const KeyboardShortcutsSection = () => {
    const { t } = useTranslation();
    const copy = t.settings.shortcuts;
    const edit = copy.edit;
    const platform = currentPlatform();
    const { loaded, set } = useUiSettings();
    useShortcutsVersion();
    const overrides = getOverrides(platform);
    const hasCustom = Object.keys(overrides).length > 0;

    const [recordingId, setRecordingId] = useState<ShortcutId | null>(null);
    const [problem, setProblem] = useState<{ id: ShortcutId; text: string } | null>(null);
    const [announcement, setAnnouncement] = useState("");
    const buttons = useRef(new Map<ShortcutId, HTMLElement>());

    const stop = () => {
        setRecording(false);
        setRecordingId(null);
    };

    // Never leave the shortcuts silenced: closing Settings mid-recording, or the editor
    // going disabled (the account reloading), ends it.
    useEffect(() => () => setRecording(false), []);
    if (!loaded && recordingId !== null) setRecordingId(null);
    useEffect(() => {
        if (!loaded) setRecording(false);
    }, [loaded]);

    const labelOf = (id: ShortcutId) => shortcutLabel(id, t);
    const textOf = (parts: string[]) => isolate(parts.join("+"));
    const family = textOf(chordParts(customChord("a", platform), platform).slice(0, -1));

    const save = (next: Overrides) =>
        set(SHORTCUT_SETTINGS_KEYS[platform], serializeOverrides(next));

    const refuse = (id: ShortcutId, text: string) => {
        setProblem({ id, text });
        setAnnouncement(text);
    };

    const start = (id: ShortcutId) => {
        setRecording(true);
        setRecordingId(id);
        setProblem(null);
        setAnnouncement(fmt(edit.started, { label: labelOf(id), keys: family }));
        // Safari does not focus a button on click, and the keys are read from it.
        buttons.current.get(id)?.focus();
    };

    const cancel = () => {
        stop();
        setProblem(null);
        setAnnouncement(edit.cancelled);
    };

    const assign = (id: ShortcutId, chord: Chord) => {
        const keys = textOf(chordParts(chord, platform));
        const taken = findConflict(chord, id, overrides, platform);
        if (taken) {
            refuse(id, fmt(edit.conflict, { keys, label: labelOf(taken) }));
            return;
        }
        const next = { ...overrides, [id]: chord };
        // Pressing the built-in keys again is a reset, not a custom shortcut.
        const [builtIn] = SHORTCUTS[id].keys[platform];
        if (chordParts(builtIn, platform).join() === chordParts(chord, platform).join()) {
            delete next[id];
        }
        save(next);
        stop();
        setProblem(null);
        setAnnouncement(fmt(edit.saved, { label: labelOf(id), keys }));
    };

    const onKeyDown = (id: ShortcutId, event: KeyboardEvent) => {
        if (recordingId !== id) return;
        // Tab leaves as usual and ends the recording.
        if (event.key === "Tab") {
            cancel();
            return;
        }
        // Everything else belongs to the recorder: Escape must not close Settings.
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
            cancel();
            return;
        }
        const recorded = readRecorded(event.nativeEvent, platform);
        if (recorded.kind === "invalid") {
            refuse(id, fmt(edit.needsKeys, { keys: family }));
        } else if (recorded.kind === "reserved") {
            refuse(id, fmt(edit.reserved, { keys: textOf(chordParts(recorded.chord, platform)) }));
        } else if (recorded.kind === "chord") {
            assign(id, recorded.chord);
        }
    };

    const reset = (id: ShortcutId) => {
        stop();
        const taken = findResetConflict(id, overrides, platform);
        if (taken) {
            const keys = textOf(defaultShortcutParts(id, platform));
            refuse(id, fmt(edit.conflict, { keys, label: labelOf(taken) }));
            return;
        }
        const next = { ...overrides };
        delete next[id];
        save(next);
        setProblem(null);
        setAnnouncement(
            fmt(edit.resetDone, {
                label: labelOf(id),
                keys: textOf(defaultShortcutParts(id, platform)),
            })
        );
        // The reset button goes away with the custom chord.
        buttons.current.get(id)?.focus();
    };

    const resetAll = () => {
        stop();
        save({});
        setProblem(null);
        setAnnouncement(edit.resetAllDone);
        const [first] = Object.keys(overrides) as ShortcutId[];
        // This button disables itself: hand focus to a row it just changed.
        buttons.current.get(first)?.focus();
    };

    // A chord prints its key caps; a gesture and a pointer entry compose theirs
    // from translated words around the platform's keys.
    const comboOf = (id: ShortcutId): string[] => {
        const kind = SHORTCUTS[id].kind;
        if (kind === "gesture" && shortcutParts(id).length > 0) return shortcutParts(id);
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
        // Windows / Linux only: the Ctrl+Alt letters stay out of editors and text fields (MIP-1311).
        note:
            group === "global" && currentPlatform() === "other"
                ? copy.global.editorNote
                : undefined,
        rows: SHORTCUT_IDS.filter((id) => SHORTCUTS[id].group === group).map((id) => ({
            id,
            // Key caps read left to right in every language: chords, and gestures that print caps.
            keyCaps: SHORTCUTS[id].kind === "chord" || shortcutParts(id).length > 0,
            rebindable: "rebindable" in SHORTCUTS[id],
            custom: !!overrides[id],
            label: labelOf(id),
            combo: comboOf(id),
        })),
    }));

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack
                alignItems="center"
                direction="row"
                flexWrap="wrap"
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 0.5 }}
                useFlexGap
            >
                <Stack alignItems="center" direction="row" spacing={1}>
                    <KeyboardRoundedIcon />
                    <Typography level="title-md">{copy.heading}</Typography>
                </Stack>
                <Button
                    color="neutral"
                    data-testid="shortcut-reset-all"
                    disabled={!loaded || !hasCustom}
                    size="sm"
                    startDecorator={<RestartAltRoundedIcon />}
                    sx={{ "@media (pointer: coarse)": { minHeight: TOUCH_TARGET } }}
                    variant="plain"
                    onClick={resetAll}
                >
                    {edit.resetAll}
                </Button>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {platform === "mac" ? edit.introMac : edit.introOther}
            </Typography>
            <Box aria-live="polite" role="status" sx={visuallyHidden}>
                {announcement}
            </Box>

            <Stack spacing={2}>
                {groups.map((group, gIdx) => (
                    <Box key={group.group} data-testid={`shortcut-group-${group.group}`}>
                        <Typography level="title-sm" sx={{ mt: gIdx === 0 ? 0.5 : 0 }}>
                            {group.title}
                        </Typography>
                        <Typography level="body-xs" sx={{ mb: group.note ? 0.5 : 1 }}>
                            {group.description}
                        </Typography>
                        {group.note && (
                            <Typography
                                data-testid="shortcut-editor-note"
                                level="body-xs"
                                sx={{ mb: 1 }}
                            >
                                {group.note}
                            </Typography>
                        )}
                        <Stack spacing={0.75}>
                            {group.rows.map((row, idx) => {
                                const recording = recordingId === row.id;
                                const message = problem?.id === row.id ? problem.text : null;
                                const hint = recording ? fmt(edit.hint, { keys: family }) : null;
                                return (
                                    <Box key={row.id} data-shortcut-id={row.id}>
                                        <Stack
                                            alignItems={{ xs: "flex-start", sm: "center" }}
                                            justifyContent="space-between"
                                            spacing={{ xs: row.rebindable ? 0.5 : 2, sm: 2 }}
                                            direction={{
                                                xs: row.rebindable ? "column" : "row",
                                                sm: "row",
                                            }}
                                        >
                                            <Typography level="body-sm">{row.label}</Typography>
                                            {row.rebindable ? (
                                                <Stack
                                                    alignItems="center"
                                                    direction="row"
                                                    flexShrink={0}
                                                    flexWrap="wrap"
                                                    spacing={0.75}
                                                    useFlexGap
                                                >
                                                    {row.custom && (
                                                        <Chip size="sm" variant="soft">
                                                            {edit.custom}
                                                        </Chip>
                                                    )}
                                                    <Button
                                                        ref={(node: HTMLButtonElement | null) => {
                                                            if (node) {
                                                                buttons.current.set(row.id, node);
                                                            } else {
                                                                buttons.current.delete(row.id);
                                                            }
                                                        }}
                                                        color={recording ? "primary" : "neutral"}
                                                        disabled={!loaded}
                                                        size="sm"
                                                        variant={recording ? "soft" : "outlined"}
                                                        aria-label={
                                                            recording
                                                                ? edit.recording
                                                                : fmt(edit.change, {
                                                                      label: row.label,
                                                                      keys: textOf(row.combo),
                                                                  })
                                                        }
                                                        sx={{
                                                            px: 0.75,
                                                            "@media (pointer: coarse)": {
                                                                minHeight: TOUCH_TARGET,
                                                                minWidth: TOUCH_TARGET,
                                                            },
                                                        }}
                                                        onBlur={() => {
                                                            if (recording) stop();
                                                        }}
                                                        onClick={() => {
                                                            if (!recording) start(row.id);
                                                        }}
                                                        onKeyDown={(e: KeyboardEvent) =>
                                                            onKeyDown(row.id, e)
                                                        }
                                                    >
                                                        {recording ? (
                                                            edit.recording
                                                        ) : (
                                                            <Caps combo={row.combo} ltr />
                                                        )}
                                                    </Button>
                                                    {recording && (
                                                        <Button
                                                            color="neutral"
                                                            size="sm"
                                                            variant="plain"
                                                            sx={{
                                                                "@media (pointer: coarse)": {
                                                                    minHeight: TOUCH_TARGET,
                                                                },
                                                            }}
                                                            // Keep focus on the recorder, or its
                                                            // blur removes this button mid-click.
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={() => {
                                                                cancel();
                                                                buttons.current
                                                                    .get(row.id)
                                                                    ?.focus();
                                                            }}
                                                        >
                                                            {edit.cancel}
                                                        </Button>
                                                    )}
                                                    {row.custom && !recording && (
                                                        <AppTooltip
                                                            title={fmt(edit.reset, {
                                                                label: row.label,
                                                            })}
                                                        >
                                                            <IconButton
                                                                disabled={!loaded}
                                                                size="sm"
                                                                aria-label={fmt(edit.reset, {
                                                                    label: row.label,
                                                                })}
                                                                sx={{
                                                                    "@media (pointer: coarse)": {
                                                                        minHeight: TOUCH_TARGET,
                                                                        minWidth: TOUCH_TARGET,
                                                                    },
                                                                }}
                                                                onClick={() => reset(row.id)}
                                                            >
                                                                <RestartAltRoundedIcon />
                                                            </IconButton>
                                                        </AppTooltip>
                                                    )}
                                                </Stack>
                                            ) : (
                                                <Caps combo={row.combo} ltr={row.keyCaps} />
                                            )}
                                        </Stack>
                                        {(hint || message) && (
                                            <Typography
                                                color={message ? "danger" : undefined}
                                                data-testid="shortcut-message"
                                                level="body-xs"
                                                sx={{ mt: 0.5 }}
                                            >
                                                {message ?? hint}
                                            </Typography>
                                        )}
                                        {idx < group.rows.length - 1 && (
                                            <Divider sx={{ mt: 0.75 }} />
                                        )}
                                    </Box>
                                );
                            })}
                        </Stack>
                    </Box>
                ))}
            </Stack>
        </Sheet>
    );
};
