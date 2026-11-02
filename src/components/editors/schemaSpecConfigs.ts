import { defaultProps } from "@blocknote/core";

// The shape (`type`, `propSchema`, `content`) of every custom inline chip and
// block the editors register, with NO React, Mantine, MUI or editor state.
//
// Each editor-side spec (`Mention.tsx`, `HashMention.tsx`, `CustomEmoji.tsx`,
// `sub/Alert.tsx`) passes its config here to `createReact*Spec`, and the
// headless schema (`headlessNoteSchema.ts`) builds its schema from the SAME
// objects. That is the point of the split: a prop that exists in the editor
// but not in the headless schema is silently DROPPED from a converted
// document, and a type that is missing makes BlockNote throw "node type X not
// found in schema". Keeping one definition makes that drift impossible for
// the shape; only the `render` lives in two places, and the headless one is
// never called.
//
// Every prop is a string (the bodies round-trip through the backend
// untouched), and the defaults are what a chip written without that prop
// reads back as.

/** `@user` chip. */
export const MENTION_SPEC_CONFIG = {
    type: "mention",
    propSchema: {
        userName: {
            default: "N/A",
        },
        userId: {
            default: "N/A",
        },
    },
    content: "none",
} as const;

/** `@group` chip. The group-name default is locale text, so the caller
 * passes it in (the editors read it from the active catalog). */
export const mentionGroupSpecConfig = (groupNameFallback: string) =>
    ({
        type: "mentionGroup",
        propSchema: {
            groupName: { default: groupNameFallback },
            groupId: { default: "0" },
            memberCount: { default: "0" },
        },
        content: "none",
    }) as const;

/** `:shortcode:` team emoji. Props bake both the name and the absolute
 * image URL at insert time (see `CustomEmoji.tsx`). */
export const CUSTOM_EMOJI_SPEC_CONFIG = {
    type: "customEmoji",
    propSchema: {
        name: { default: "" },
        url: { default: "" },
    },
    content: "none",
} as const;

/** `#` task reference. */
export const HASH_TASK_SPEC_CONFIG = {
    type: "hashTask",
    propSchema: {
        projectId: { default: "" },
        taskId: { default: "" },
        displayId: { default: "" },
        title: { default: "" },
        labelMode: { default: "" },
    },
    content: "none",
} as const;

/** `#` note reference. `noteKind` drives the URL shape. */
export const HASH_NOTE_SPEC_CONFIG = {
    type: "hashNote",
    propSchema: {
        noteKind: { default: "my" },
        noteId: { default: "" },
        title: { default: "" },
        projectId: { default: "" },
        taskId: { default: "" },
        chatType: { default: "" },
        chatId: { default: "" },
        threadId: { default: "0" },
    },
    content: "none",
} as const;

/** `#` chat reference (GM only). */
export const HASH_CHAT_SPEC_CONFIG = {
    type: "hashChat",
    propSchema: {
        chatId: { default: "" },
        chatName: { default: "" },
    },
    content: "none",
} as const;

/** `#` project reference. */
export const HASH_PROJECT_SPEC_CONFIG = {
    type: "hashProject",
    propSchema: {
        projectId: { default: "" },
        projectName: { default: "" },
    },
    content: "none",
} as const;

/** The callout block. */
export const ALERT_SPEC_CONFIG = {
    type: "alert",
    propSchema: {
        textAlignment: defaultProps.textAlignment,
        textColor: defaultProps.textColor,
        type: {
            default: "warning",
            values: ["warning", "error", "info", "success"],
        },
    },
    content: "inline",
} as const;
