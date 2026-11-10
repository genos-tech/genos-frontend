import { DefaultReactSuggestionItem, getDefaultReactSlashMenuItems } from "@blocknote/react";

import { withGenosBlockSlashItems } from "../genosBlockSpecs";
import { withGifSlashItem } from "../GifToolbarButton";

// The editors hand this the editor they built, whose type depends on the schema; the helpers it
// calls take it loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = any;

/**
 * The `/` menu per surface kind (MIP-1131). Both start from BlockNote's default items plus
 * the Genos GIF entry; `document` (notes, task bodies, templates) adds the math and diagram
 * blocks. Every type is in every SCHEMA either way; this only decides what a menu offers.
 *
 * `todo` (MIP-1334) is `document` without the media group: a to-do's notes have nowhere to
 * upload a file to, so image, video, audio, file and GIF are left out rather than offered and
 * failing.
 */
export type SlashPreset = "chat" | "document" | "todo";

/** The slash items that need an upload target (and the GIF, an image by another name). */
export const MEDIA_SLASH_KEYS: ReadonlySet<string> = new Set(["image", "video", "audio", "file"]);

export const genosSlashItems = (
    preset: SlashPreset,
    editor: AnyEditor,
    setShowGifPicker: (value: boolean) => void
): DefaultReactSuggestionItem[] => {
    const defaults = getDefaultReactSlashMenuItems(editor);
    if (preset === "todo") {
        return withGenosBlockSlashItems(
            editor,
            defaults.filter((item) => !MEDIA_SLASH_KEYS.has((item as { key?: string }).key ?? ""))
        );
    }
    const withGif = withGifSlashItem(defaults, setShowGifPicker);
    return preset === "document" ? withGenosBlockSlashItems(editor, withGif) : withGif;
};
