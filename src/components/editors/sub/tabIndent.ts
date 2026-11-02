import { createExtension } from "@blocknote/core";

/**
 * Tab indents, in every Genos editor (MIP-664).
 *
 * BlockNote's default `tabBehavior` is "prefer-navigate-ui": while the
 * formatting toolbar is open, Tab is NOT handled so a keyboard user can tab
 * into the toolbar. Selecting more than one line is exactly when the toolbar
 * opens, so Tab then moved focus to a toolbar button and indented nothing,
 * while a single line (no toolbar) indented fine. "prefer-indent" always
 * indents, and BlockNote already nests every block in a selection together.
 *
 * Spread this into the options of `useCreateBlockNote`. The trade-off is
 * that Tab no longer reaches the formatting toolbar from the keyboard; the
 * mouse is unaffected.
 */
export const TAB_INDENT_OPTIONS = { tabBehavior: "prefer-indent" } as const;

/** Block types that give Tab a meaning of their own: a code block inserts
 *  the indent, and a table moves to the next cell. */
const OWN_TAB_BLOCKS = new Set(["codeBlock", "table"]);

/**
 * Keeps Tab and Shift+Tab inside the editor in the cases where there is
 * nothing to indent.
 *
 * `nestBlock` refuses when there is no block above to nest under (the first
 * block, or the first of a selection starting there), and BlockNote then
 * returns false, so the browser takes the key and moves focus out of the
 * editor: the same symptom as the toolbar one. Shift+Tab does the same on a
 * block already at the top level. This does the nesting itself and then
 * always claims the key.
 *
 * Extensions run before BlockNote's built-in Tab handling, and in the order
 * given alongside the code block and table handlers, so those two block types
 * are left alone (false = not handled here).
 *
 * Add this only to document-style editors (notes, task bodies, to-do notes):
 * a key that can never leave the editor is right where you write a document,
 * and wrong in a chat box, where Tab is how a keyboard user reaches Send.
 */
export const tabStaysInEditor = createExtension({
    key: "tab-stays-in-editor",
    keyboardShortcuts: {
        Tab: ({ editor }) => {
            if (OWN_TAB_BLOCKS.has(editor.getTextCursorPosition().block.type)) return false;
            editor.nestBlock();
            return true;
        },
        "Shift-Tab": ({ editor }) => {
            if (OWN_TAB_BLOCKS.has(editor.getTextCursorPosition().block.type)) return false;
            editor.unnestBlock();
            return true;
        },
    },
});
