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
 */
export type SlashPreset = "chat" | "document";

export const genosSlashItems = (
    preset: SlashPreset,
    editor: AnyEditor,
    setShowGifPicker: (value: boolean) => void
): DefaultReactSuggestionItem[] => {
    const withGif = withGifSlashItem(getDefaultReactSlashMenuItems(editor), setShowGifPicker);
    return preset === "document" ? withGenosBlockSlashItems(editor, withGif) : withGif;
};
