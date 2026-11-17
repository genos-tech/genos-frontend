/**
 * Which rows the Chat Notes family shows (MIP-1430).
 *
 * Chat notes are grouped by the data (chat type › chat), but the sidebar draws one level fewer:
 * chat › note. The folder level of the kind of chat costs a click and a row to say what a hover can.
 * This says what is drawn; `NoteSidebar` draws it. (Task Notes had the same flattening for the
 * milestone until MIP-1667 gave it the real task tree: see `taskNoteFolders`.)
 */

/** Chats of every kind in one list, each with the name of its kind (for the hover). Order
 *  is kept: kinds in the order they were first seen, chats in the order they were grouped. */
export const chatRows = <C>(
    groups: readonly { chatTypeName: string; chats: readonly C[] }[]
): { chat: C; kindName: string }[] =>
    groups.flatMap((group) => group.chats.map((chat) => ({ chat, kindName: group.chatTypeName })));
