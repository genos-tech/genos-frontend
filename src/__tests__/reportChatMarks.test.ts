/**
 * MIP-1333: which chat a "Messages sent" line names, and what its avatar is made of.
 *
 * The link only picks one of the member's OWN chats; every string a mark carries comes from that
 * chat, never from the report. A link that is junk, or names a chat the member does not have,
 * gives no mark (the line keeps its emoji) and never throws.
 */

import { describe, expect, it } from "vitest";

import { parseGenosReportV2 } from "../features/inbox/utils/genosReportV2";
import {
    chatMarkKey,
    parseReportChatLink,
    reportChatKeys,
    reportChatMarkMap,
    sameChatMarks,
    type ReportChatMark,
} from "../features/inbox/utils/reportChatMarks";

const UUID = "3f2b8c1e-9a4d-4c6e-8b1f-0a7d5e2c9b34";
const UUID2 = "aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb";

describe("parseReportChatLink", () => {
    it.each(["dm", "gm", "pm", "mdm"] as const)("reads a %s link", (kind) => {
        expect(parseReportChatLink(`/workspace/chat/${kind}/${UUID}`)).toEqual({
            kind,
            id: UUID,
        });
    });

    it("ignores a thread, message or comment suffix, a query, a hash and a trailing slash", () => {
        for (const tail of [
            "/thread/9c1d6a52-0000-4000-8000-000000000001",
            "/thread/12/message/5",
            "/thread/12/comment/5",
            "/message/5",
            "/",
            "?x=1",
            "#frag",
            "/thread/12?x=1#y",
        ]) {
            expect(parseReportChatLink(`/workspace/chat/gm/${UUID}${tail}`)).toEqual({
                kind: "gm",
                id: UUID,
            });
        }
    });

    it("keeps the id's case (the lookup key is what lower-cases it)", () => {
        const upper = UUID.toUpperCase();
        expect(parseReportChatLink(`/workspace/chat/dm/${upper}`)?.id).toBe(upper);
        expect(chatMarkKey("dm", upper)).toBe(chatMarkKey("dm", UUID));
    });

    it("accepts a numeric id from before the v3 move", () => {
        expect(parseReportChatLink("/workspace/chat/dm/123")).toEqual({ kind: "dm", id: "123" });
    });

    it.each([
        ["null", null],
        ["undefined", undefined],
        ["empty", ""],
        ["a number", 7 as never],
        ["an object", {} as never],
        ["a task link", "/workspace/tasks/project/3/task/9"],
        ["https", `https://example.com/workspace/chat/dm/${UUID}`],
        ["protocol-relative", `//evil.test/workspace/chat/dm/${UUID}`],
        ["no id", "/workspace/chat/dm"],
        ["no id, slash", "/workspace/chat/dm/"],
        ["no kind", "/workspace/chat/"],
        ["the activity kind", `/workspace/chat/activity/${UUID}`],
        ["the flagged kind", `/workspace/chat/flagged/${UUID}`],
        ["an unknown kind", `/workspace/chat/xx/${UUID}`],
        ["an upper-case kind", `/workspace/chat/DM/${UUID}`],
        ["a prototype key as kind", `/workspace/chat/__proto__/${UUID}`],
        ["an id that is not id-shaped", "/workspace/chat/dm/not a uuid"],
        ["an id with markup", "/workspace/chat/dm/<b>x</b>"],
        ["an id that is too long", `/workspace/chat/dm/${"a".repeat(65)}`],
        ["a segment after the id that is not a deep link", `/workspace/chat/dm/${UUID}/extra`],
        ["a prefix lookalike", `/workspace/chatter/dm/${UUID}`],
        ["a missing leading slash", `workspace/chat/dm/${UUID}`],
    ])("returns null for %s, without throwing", (_name, link) => {
        expect(parseReportChatLink(link as never)).toBeNull();
    });
});

const chat = (over: Record<string, unknown>) => ({
    chatType: 2,
    chatId: UUID,
    chatName: "Team",
    ...over,
});

describe("reportChatMarkMap: one mark per chat type", () => {
    const keysFor = (...pairs: Array<["dm" | "gm" | "pm" | "mdm", string]>) =>
        new Set(pairs.map(([k, id]) => chatMarkKey(k, id)));

    it("DM: the other person, taken from the chat list's dmPartnerUser", () => {
        const marks = reportChatMarkMap(keysFor(["dm", UUID]), [
            chat({
                chatType: 1,
                chatName: "Ada Lovelace",
                dmPartnerUser: { userId: "u-ada", userName: "Ada Lovelace" },
            }),
        ]);
        expect(marks.get(chatMarkKey("dm", UUID))).toEqual({
            kind: "dm",
            userId: "u-ada",
            name: "Ada Lovelace",
        });
    });

    it("self-DM: the list's partner is the viewer, so the mark is the viewer", () => {
        // `useChatListItem`: `isYou = myself.userId === chat.dmPartnerUser.userId`. The partner of a
        // DM with yourself is yourself, and the mark carries that id; the avatar context then
        // resolves it to the viewer's own picture.
        const marks = reportChatMarkMap(keysFor(["dm", UUID]), [
            chat({
                chatType: 1,
                dmPartnerUser: { userId: "me", userName: "Me" },
            }),
        ]);
        expect(marks.get(chatMarkKey("dm", UUID))).toMatchObject({ kind: "dm", userId: "me" });
    });

    it("DM whose partner is not known: the chat name's letter, as the chat list does", () => {
        const marks = reportChatMarkMap(keysFor(["dm", UUID]), [
            chat({ chatType: 1, chatName: "Grace", dmPartnerUser: { userId: "", userName: "" } }),
        ]);
        expect(marks.get(chatMarkKey("dm", UUID))).toEqual({ kind: "initial", name: "Grace" });
        const none = reportChatMarkMap(keysFor(["dm", UUID]), [
            { chatType: 1, chatId: UUID } as never,
        ]);
        expect(none.get(chatMarkKey("dm", UUID))).toEqual({ kind: "initial", name: "" });
    });

    it("GM and PM: the chat's own picture, when it has one", () => {
        const marks = reportChatMarkMap(keysFor(["gm", UUID], ["pm", UUID2]), [
            chat({ chatType: 2, profileImagePath: "https://m.example/gm.png" }),
            chat({ chatType: 3, chatId: UUID2, profileImagePath: "https://m.example/pm.png" }),
        ]);
        // A group's mark also carries the key of its upload version (MIP-1472).
        expect(marks.get(chatMarkKey("gm", UUID))).toEqual({
            kind: "gm",
            src: "https://m.example/gm.png",
            chatType: 2,
            chatId: UUID,
        });
        expect(marks.get(chatMarkKey("pm", UUID2))).toEqual({
            kind: "pm",
            src: "https://m.example/pm.png",
        });
    });

    it("GM and PM without a picture: a mark with no src (the avatar shows its icon)", () => {
        const marks = reportChatMarkMap(keysFor(["gm", UUID], ["pm", UUID2]), [
            chat({ chatType: 2 }),
            chat({ chatType: 3, chatId: UUID2, profileImagePath: "" }),
        ]);
        expect(marks.get(chatMarkKey("gm", UUID))).toEqual({
            kind: "gm",
            src: undefined,
            chatType: 2,
            chatId: UUID,
        });
        expect(marks.get(chatMarkKey("pm", UUID2))).toEqual({ kind: "pm", src: undefined });
    });

    it("MDM: the group mark", () => {
        const marks = reportChatMarkMap(keysFor(["mdm", UUID]), [chat({ chatType: 4 })]);
        expect(marks.get(chatMarkKey("mdm", UUID))).toEqual({ kind: "mdm" });
    });
});

describe("reportChatMarkMap: when there is no mark", () => {
    it("the chat is not in the list (left it, another team)", () => {
        const marks = reportChatMarkMap(new Set([chatMarkKey("gm", UUID)]), [
            chat({ chatId: UUID2 }),
        ]);
        expect(marks.size).toBe(0);
    });

    it("the id exists but under another type: a gm link never finds a DM", () => {
        const marks = reportChatMarkMap(new Set([chatMarkKey("gm", UUID)]), [
            chat({ chatType: 1, dmPartnerUser: { userId: "u", userName: "U" } }),
        ]);
        expect(marks.size).toBe(0);
    });

    it("a chat list row of a type the card does not know (activity, flagged, junk) is skipped", () => {
        const marks = reportChatMarkMap(new Set([chatMarkKey("gm", UUID)]), [
            chat({ chatType: 5 }),
            chat({ chatType: 6 }),
            chat({ chatType: 99 }),
            chat({ chatId: 7 }),
        ]);
        expect(marks.size).toBe(0);
    });

    it("finds a lower-case chat id from an upper-case link", () => {
        const marks = reportChatMarkMap(new Set([chatMarkKey("gm", UUID.toUpperCase())]), [
            chat({ chatId: UUID }),
        ]);
        expect(marks.size).toBe(1);
    });

    it("never looks at the list when no chat is wanted, or when there is no list", () => {
        const trap = new Proxy([], {
            get() {
                throw new Error("the chat list was scanned");
            },
        });
        expect(reportChatMarkMap(new Set(), trap as never).size).toBe(0);
        expect(reportChatMarkMap(new Set([chatMarkKey("gm", UUID)]), undefined).size).toBe(0);
    });

    it("stops scanning once every wanted chat is found", () => {
        let reads = 0;
        const row = (over: Record<string, unknown>) =>
            new Proxy(chat(over), {
                get(target, key) {
                    if (key === "chatType") reads += 1;
                    return Reflect.get(target, key);
                },
            });
        const list = [row({}), row({ chatId: UUID2 }), row({ chatId: "c" }), row({ chatId: "d" })];
        reportChatMarkMap(new Set([chatMarkKey("gm", UUID)]), list as never);
        expect(reads).toBe(1);
    });
});

describe("reportChatKeys", () => {
    const body = (items: unknown[]) =>
        parseGenosReportV2({ version: 2, sections: [{ heading: "Messages sent", items }] });

    it("collects the chats of chat lines only, once each", () => {
        const report = body([
            { text: "a: 2 messages", kind: "chat", link: `/workspace/chat/dm/${UUID}` },
            { text: "a again", kind: "chat", link: `/workspace/chat/dm/${UUID.toUpperCase()}` },
            { text: "b", kind: "chat", link: `/workspace/chat/gm/${UUID2}/thread/4` },
            // Not a chat line: a chat link on another kind never gets an avatar.
            { text: "note", kind: "note", link: `/workspace/chat/pm/${UUID}` },
            { text: "no link", kind: "chat" },
            { text: "junk", kind: "chat", link: "/workspace/chat/zz/1" },
        ]);
        expect([...reportChatKeys(report)].sort()).toEqual(
            [chatMarkKey("dm", UUID), chatMarkKey("gm", UUID2)].sort()
        );
    });

    it("is empty for no report and for a report with no chat line", () => {
        expect(reportChatKeys(null).size).toBe(0);
        expect(reportChatKeys(body([{ text: "t", kind: "task" }])).size).toBe(0);
    });
});

describe("sameChatMarks", () => {
    const m = (marks: Array<[string, ReportChatMark]>) => new Map(marks);
    it("compares by value, per kind", () => {
        const a = m([["k", { kind: "gm", src: "x" }]]);
        expect(sameChatMarks(a, m([["k", { kind: "gm", src: "x" }]]))).toBe(true);
        expect(sameChatMarks(a, m([["k", { kind: "gm", src: "y" }]]))).toBe(false);
        expect(sameChatMarks(a, m([["k", { kind: "pm", src: "x" }]]))).toBe(false);
        expect(sameChatMarks(a, m([]))).toBe(false);
        expect(sameChatMarks(a, m([["j", { kind: "gm", src: "x" }]]))).toBe(false);
        const dm = m([["k", { kind: "dm", userId: "u", name: "N" }]]);
        expect(sameChatMarks(dm, m([["k", { kind: "dm", userId: "u", name: "N" }]]))).toBe(true);
        expect(sameChatMarks(dm, m([["k", { kind: "dm", userId: "v", name: "N" }]]))).toBe(false);
        expect(sameChatMarks(dm, m([["k", { kind: "dm", userId: "u", name: "M" }]]))).toBe(false);
        const ini = m([["k", { kind: "initial", name: "N" }]]);
        expect(sameChatMarks(ini, m([["k", { kind: "initial", name: "N" }]]))).toBe(true);
        expect(sameChatMarks(ini, m([["k", { kind: "initial", name: "O" }]]))).toBe(false);
        expect(sameChatMarks(m([["k", { kind: "mdm" }]]), m([["k", { kind: "mdm" }]]))).toBe(true);
    });
});
