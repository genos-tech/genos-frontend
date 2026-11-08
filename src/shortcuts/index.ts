export {
    EDITOR_CHORDS,
    SHORTCUT_IDS,
    SHORTCUTS,
    chordMatches,
    currentPlatform,
    cycleKeys,
    isEditableTarget,
    matchesShortcut,
    shortcutLabel,
    shortcutParts,
    shortcutText,
    threadClickModifier,
} from "./registry";
export type {
    Chord,
    EditablePolicy,
    KeyLike,
    Modifier,
    Platform,
    ShortcutCatalog,
    ShortcutDef,
    ShortcutGroup,
    ShortcutId,
    ShortcutKind,
    ShortcutScope,
} from "./registry";
export { useShortcut } from "./useShortcut";
