// The chat behind a "Messages sent" line of a Genos report (MIP-1333).
//
// The api sends a chat line as `{text, link, kind: "chat"}` with `link` =
// `/workspace/chat/<dm|gm|pm|mdm>/<chat id>[/thread/<id>]` and nothing else about the chat. The
// card shows the chat's own avatar beside the line, so the chat is found in the member's chat
// list (already in memory, no request) and reduced to the few strings the avatar needs.
//
// Nothing here ever reads text from the report to draw: the link only picks WHICH of the
// member's own chats is meant, and every string a mark carries comes from that chat. A link
// that does not parse, or names a chat the member does not have (left it, another team), has no
// mark, and the line keeps its generic emoji.

import { buildAvatarSrc } from "../../../utils/avatarSrc";
import { CHAT_TYPE_REVERSE_MAP } from "../../chat/utils/chatPaths";
import type { GenosReportV2 } from "./genosReportV2";

export type ReportChatKind = "dm" | "gm" | "pm" | "mdm";

const KINDS: ReadonlySet<string> = new Set<ReportChatKind>(["dm", "gm", "pm", "mdm"]);
const APP_CHAT_PREFIX = "/workspace/chat/";
const DEEP_LINK: ReadonlySet<string> = new Set(["thread", "message", "comment"]);
// A chat id is a uuid (a numeric id from before the v3 move still parses). It is only ever a
// lookup key, never drawn, but a segment that is not id-shaped is junk and ends the parse.
const CHAT_ID = /^[0-9a-f-]{1,64}$/i;

/** `dm:<id>`, the key a chat is found by. The id is lower-cased: a uuid is case-insensitive. */
export const chatMarkKey = (kind: ReportChatKind, id: string): string =>
    `${kind}:${id.toLowerCase()}`;

/** The chat a report link names, or null for anything else. Never throws. A `/thread/...`
 *  (or message, comment), query or hash after the chat id is ignored: the line is about the chat. */
export const parseReportChatLink = (
    link: string | null | undefined
): { kind: ReportChatKind; id: string } | null => {
    if (typeof link !== "string" || !link.startsWith(APP_CHAT_PREFIX)) return null;
    const path = link.split(/[?#]/, 1)[0];
    const [kind, id, ...rest] = path.slice(APP_CHAT_PREFIX.length).split("/");
    if (!KINDS.has(kind) || id === undefined || !CHAT_ID.test(id)) return null;
    // Only what `parseChatRoute` knows may follow the id (a thread, message or comment, or a
    // trailing slash); `/dm/<id>/anything-else` is not a chat line this card knows.
    if (rest.length > 0 && rest[0] !== "" && !DEEP_LINK.has(rest[0])) return null;
    return { kind: kind as ReportChatKind, id };
};

/** What the avatar of one chat needs, as primitives so two marks compare by value. */
export type ReportChatMark =
    /** A DM: the OTHER person (the chat list's `dmPartnerUser`; in a DM with yourself that is
     *  you). Their picture comes from the avatar context at draw time. */
    | { kind: "dm"; userId: string; name: string }
    /** A DM whose partner is not known yet: the chat name's first letter, as the chat list does. */
    | { kind: "initial"; name: string }
    /** A group chat: its picture, and the key of its upload version (`?v=`), so a picture
     *  uploaded this session is refetched here as in the chat list. */
    | { kind: "gm"; src: string | undefined; chatType: number; chatId: string }
    | { kind: "pm"; src: string | undefined }
    | { kind: "mdm" };

export const sameChatMark = (a: ReportChatMark, b: ReportChatMark): boolean => {
    if (a.kind !== b.kind) return false;
    switch (a.kind) {
        case "dm":
            return b.kind === "dm" && a.userId === b.userId && a.name === b.name;
        case "initial":
            return b.kind === "initial" && a.name === b.name;
        case "gm":
            return (
                b.kind === "gm" &&
                a.src === b.src &&
                a.chatType === b.chatType &&
                a.chatId === b.chatId
            );
        case "pm":
            return b.kind === "pm" && a.src === b.src;
        default:
            return true;
    }
};

type ChatLike = {
    chatType: number;
    chatId: string;
    chatName?: string;
    profileImagePath?: string;
    dmPartnerUser?: { userId?: string; userName?: string } | null;
};

/** The keys of the chats a report's chat lines name (none when it has no chat line). */
export const reportChatKeys = (report: GenosReportV2 | null): Set<string> => {
    const keys = new Set<string>();
    if (!report) return keys;
    for (const section of report.sections) {
        for (const item of section.items) {
            if (item.kind !== "chat") continue;
            const parsed = parseReportChatLink(item.link);
            if (parsed) keys.add(chatMarkKey(parsed.kind, parsed.id));
        }
    }
    return keys;
};

const markOf = (kind: ReportChatKind, chat: ChatLike, chatType: number): ReportChatMark => {
    switch (kind) {
        case "dm": {
            const userId = chat.dmPartnerUser?.userId ?? "";
            // Same split as the chat list's row avatar: a partner we know gets their avatar,
            // one we do not yet gets the chat name's letter.
            return userId !== ""
                ? { kind: "dm", userId, name: chat.dmPartnerUser?.userName ?? "" }
                : { kind: "initial", name: chat.chatName ?? "" };
        }
        case "gm":
            return {
                kind: "gm",
                src: buildAvatarSrc(chat.profileImagePath),
                chatType,
                chatId: chat.chatId,
            };
        case "pm":
            return { kind: "pm", src: buildAvatarSrc(chat.profileImagePath) };
        default:
            return { kind: "mdm" };
    }
};

/** The marks for `keys`, read from the member's chat list: one scan that stops once every
 *  wanted chat is found. `keys` empty returns without looking at the list. */
export const reportChatMarkMap = (
    keys: ReadonlySet<string>,
    allChats: readonly ChatLike[] | undefined
): Map<string, ReportChatMark> => {
    const marks = new Map<string, ReportChatMark>();
    if (keys.size === 0 || !allChats) return marks;
    for (const chat of allChats) {
        const chatType = chat.chatType;
        const kind = CHAT_TYPE_REVERSE_MAP[chatType];
        if (!KINDS.has(kind) || typeof chat.chatId !== "string") continue;
        const key = chatMarkKey(kind as ReportChatKind, chat.chatId);
        if (!keys.has(key) || marks.has(key)) continue;
        marks.set(key, markOf(kind as ReportChatKind, chat, chatType));
        if (marks.size === keys.size) break;
    }
    return marks;
};

export const sameChatMarks = (
    a: ReadonlyMap<string, ReportChatMark>,
    b: ReadonlyMap<string, ReportChatMark>
): boolean => {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
        const other = b.get(k);
        if (!other || !sameChatMark(v, other)) return false;
    }
    return true;
};
