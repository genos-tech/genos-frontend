import { useEffect } from "react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { useBlockNoteEditor, useExtensionState } from "@blocknote/react";

import { blockSelector } from "./useNoteDeepLink";

/** The class that tints the block a drag-handle menu is open for (see `App.css`). */
export const MENU_TARGET_CLASS = "bn-menu-target";

/**
 * Highlights the block a block's drag-handle menu is open for, for as long as it is open
 * (MIP-1654).
 *
 * The menu offers "Copy link to block", Delete, Colors and Reset type, and nothing on screen said
 * WHICH block they act on once the pointer left it. Put this inside the menu's dropdown: BlockNote
 * mounts the dropdown's content only while the menu is open, so mounting this is "the menu opened"
 * and unmounting it is "it closed" (choosing an item, Escape, a click elsewhere), with no state to
 * keep in step. It renders nothing and changes no document: it adds one class to the block's
 * element and takes it off again. The block comes from the same side-menu state the menu items read,
 * so it is always the block the menu is for, a nested child included.
 */
export const MenuTargetHighlight = () => {
    const editor = useBlockNoteEditor();
    const blockId = useExtensionState(SideMenuExtension, {
        editor,
        selector: (state) => state?.block?.id,
    });

    useEffect(() => {
        const root = editor.domElement;
        if (!root || !blockId) return;
        root.querySelector(blockSelector(blockId))?.classList.add(MENU_TARGET_CLASS);
        return () => {
            // Every marked block of THIS editor, not just the one found above: the editor may have
            // redrawn that element meanwhile, and a stuck tint is worse than a repeated query.
            root.querySelectorAll(`.${MENU_TARGET_CLASS}`).forEach((el) =>
                el.classList.remove(MENU_TARGET_CLASS)
            );
        };
    }, [editor, blockId]);

    return null;
};
