import { describe, expect, it } from "vitest";

import { isLegacyNumericId, isV3Uuid } from "../../utils/legacyId";
import { parseInternalUrl } from "../../utils/parseInternalUrl";
import { replaceSpacesWithUnderscore } from "../../utils/stringHelper";
import {
    formatBytes,
    isFileSizeAllowed,
    MAX_UPLOAD_FILE_SIZE_BYTES,
    MAX_UPLOAD_FILE_SIZE_LABEL,
    partitionBySize,
} from "../../utils/uploadLimits";
import { getDomainFromUrl } from "../../utils/urlHandler";

// jsdom default origin is http://localhost:3000 (matches vite.config server.port).
const ORIGIN = "http://localhost:3000";

// --------------------------------------------------------------------------
// legacyId.ts
// --------------------------------------------------------------------------

describe("isLegacyNumericId", () => {
    it("returns true for a pure digit string", () => {
        expect(isLegacyNumericId("123")).toBe(true);
        expect(isLegacyNumericId("0")).toBe(true);
        expect(isLegacyNumericId("007")).toBe(true); // leading zeros still all digits
    });

    it("returns true for a finite number coerced to a digit string", () => {
        expect(isLegacyNumericId(42)).toBe(true);
        expect(isLegacyNumericId(0)).toBe(true);
    });

    it("returns false for null and undefined", () => {
        expect(isLegacyNumericId(null)).toBe(false);
        expect(isLegacyNumericId(undefined)).toBe(false);
    });

    it("returns false for an empty string (no digits)", () => {
        expect(isLegacyNumericId("")).toBe(false);
    });

    it("returns false for negative, decimal, or whitespace-padded numbers", () => {
        // String(-5) === "-5" -> the '-' fails /^\d+$/
        expect(isLegacyNumericId(-5)).toBe(false);
        expect(isLegacyNumericId("-5")).toBe(false);
        // String(1.5) === "1.5" -> the '.' fails the digit-only regex
        expect(isLegacyNumericId(1.5)).toBe(false);
        expect(isLegacyNumericId(" 7 ")).toBe(false);
        expect(isLegacyNumericId("7\n")).toBe(false);
    });

    it("returns false for a UUID or any string containing non-digits", () => {
        expect(isLegacyNumericId("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
        expect(isLegacyNumericId("12a")).toBe(false);
        expect(isLegacyNumericId("abc")).toBe(false);
    });
});

describe("isV3Uuid", () => {
    it("returns true for a canonical lowercase UUID", () => {
        expect(isV3Uuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    });

    it("returns true for an uppercase / mixed-case UUID (case-insensitive)", () => {
        expect(isV3Uuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
        expect(isV3Uuid("550e8400-E29b-41D4-a716-446655440000")).toBe(true);
    });

    it("returns false for null and undefined", () => {
        expect(isV3Uuid(null)).toBe(false);
        expect(isV3Uuid(undefined)).toBe(false);
    });

    it("returns false for a legacy numeric id", () => {
        expect(isV3Uuid("123")).toBe(false);
        expect(isV3Uuid(123)).toBe(false);
    });

    it("returns false for malformed UUID-ish strings", () => {
        expect(isV3Uuid("")).toBe(false);
        // wrong group lengths
        expect(isV3Uuid("550e840-e29b-41d4-a716-446655440000")).toBe(false);
        // non-hex characters (g, z)
        expect(isV3Uuid("zzze8400-e29b-41d4-a716-446655440000")).toBe(false);
        // missing dashes
        expect(isV3Uuid("550e8400e29b41d4a716446655440000")).toBe(false);
        // extra trailing content (anchored regex rejects)
        expect(isV3Uuid("550e8400-e29b-41d4-a716-446655440000x")).toBe(false);
        // leading whitespace
        expect(isV3Uuid(" 550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    });

    it("treats a malformed dashed string as neither legacy nor UUID", () => {
        const weird = "ab-cd";
        expect(isLegacyNumericId(weird)).toBe(false);
        expect(isV3Uuid(weird)).toBe(false);
    });
});

// --------------------------------------------------------------------------
// parseInternalUrl.ts
// --------------------------------------------------------------------------

describe("parseInternalUrl - external / route fallback", () => {
    it("classifies a syntactically invalid URL as external", () => {
        // `new URL` with a base still throws on some inputs; "http://" has no host.
        expect(parseInternalUrl("http://")).toEqual({ kind: "external" });
    });

    it("classifies a different origin as external", () => {
        expect(parseInternalUrl("https://example.com/workspace/chat/dm/5")).toEqual({
            kind: "external",
        });
    });

    it("classifies a non-workspace same-origin path as a route", () => {
        expect(parseInternalUrl(`${ORIGIN}/home`)).toEqual({
            kind: "route",
            pathname: "/home",
            search: "",
        });
    });

    it("preserves the query string on route classifications", () => {
        expect(parseInternalUrl(`${ORIGIN}/signin?next=/workspace`)).toEqual({
            kind: "route",
            pathname: "/signin",
            search: "?next=/workspace",
        });
    });

    it("resolves a relative href against the current origin", () => {
        expect(parseInternalUrl("/settings")).toEqual({
            kind: "route",
            pathname: "/settings",
            search: "",
        });
    });

    it("falls back to a route for an unknown workspace subsection", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/calendar/42`)).toEqual({
            kind: "route",
            pathname: "/workspace/calendar/42",
            search: "",
        });
    });
});

describe("parseInternalUrl - chat targets", () => {
    it("parses a chatMain target", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/chat/dm/5`)).toEqual({
            kind: "chatMain",
            chatType: 1,
            chatId: 5,
            messageId: undefined,
        });
    });

    it("maps each chat type token to its numeric code", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/chat/gm/5`)).toMatchObject({ chatType: 2 });
        expect(parseInternalUrl(`${ORIGIN}/workspace/chat/pm/5`)).toMatchObject({ chatType: 3 });
        expect(parseInternalUrl(`${ORIGIN}/workspace/chat/mdm/5`)).toMatchObject({ chatType: 4 });
    });

    it("captures a messageId on a chatMain target", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/chat/dm/5/message/99`)).toEqual({
            kind: "chatMain",
            chatType: 1,
            chatId: 5,
            messageId: 99,
        });
    });

    it("prefers a thread target when a thread segment is present (deeper wins)", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/chat/dm/5/thread/7/message/99`)).toEqual({
            kind: "chatThread",
            chatType: 1,
            chatId: 5,
            threadId: 7,
            messageId: 99,
            commentId: undefined,
        });
    });

    it("captures a commentId on a chatThread target", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/chat/gm/3/thread/7/comment/12`)).toEqual({
            kind: "chatThread",
            chatType: 2,
            chatId: 3,
            threadId: 7,
            messageId: undefined,
            commentId: 12,
        });
    });

    it("falls back to a route for an unknown chat type token", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/chat/xx/5`)).toMatchObject({ kind: "route" });
    });

    it("falls back to a route when the chatId is missing or non-positive", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/chat/dm`)).toMatchObject({ kind: "route" });
        // chatId 0 is rejected by toInt (requires > 0)
        expect(parseInternalUrl(`${ORIGIN}/workspace/chat/dm/0`)).toMatchObject({ kind: "route" });
        // non-numeric chatId
        expect(parseInternalUrl(`${ORIGIN}/workspace/chat/dm/abc`)).toMatchObject({
            kind: "route",
        });
    });
});

describe("parseInternalUrl - task targets", () => {
    it("parses a task target", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/tasks/project/4/task/8`)).toEqual({
            kind: "task",
            projectId: 4,
            taskId: 8,
            commentId: undefined,
        });
    });

    it("captures a commentId on a task target", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/tasks/project/4/task/8/comment/2`)).toEqual({
            kind: "task",
            projectId: 4,
            taskId: 8,
            commentId: 2,
        });
    });

    it("falls back to a route when projectId or taskId is missing", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/tasks/project/4`)).toMatchObject({
            kind: "route",
        });
    });

    it("falls back to a route for tasks not under /project", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/tasks/inbox`)).toMatchObject({
            kind: "route",
        });
    });
});

describe("parseInternalUrl - note targets", () => {
    it("parses a myNote target", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/notes/my/15`)).toEqual({
            kind: "myNote",
            noteId: 15,
        });
    });

    it("parses a sharedNote target", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/notes/shared/16`)).toEqual({
            kind: "sharedNote",
            noteId: 16,
        });
    });

    it("parses a taskNote target via positional indexing", () => {
        expect(
            parseInternalUrl(`${ORIGIN}/workspace/notes/task/project/4/task/8/note/20`)
        ).toEqual({
            kind: "taskNote",
            projectId: 4,
            taskId: 8,
            noteId: 20,
        });
    });

    it("parses a chatNote target", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/notes/chat/dm/5/thread/7/note/30`)).toEqual({
            kind: "chatNote",
            chatType: 1,
            chatId: 5,
            threadId: 7,
            noteId: 30,
        });
    });

    it("accepts threadId === 0 as the not-in-a-thread sentinel for chat notes", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/notes/chat/dm/5/thread/0/note/30`)).toEqual({
            kind: "chatNote",
            chatType: 1,
            chatId: 5,
            threadId: 0,
            noteId: 30,
        });
    });

    it("falls back to a route when a note id is missing or invalid", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/notes/my/abc`)).toMatchObject({
            kind: "route",
        });
        // noteId 0 is rejected by toInt (> 0)
        expect(parseInternalUrl(`${ORIGIN}/workspace/notes/my/0`)).toMatchObject({
            kind: "route",
        });
        expect(parseInternalUrl(`${ORIGIN}/workspace/notes/my`)).toMatchObject({
            kind: "route",
        });
    });

    it("falls back to a route for an unrecognised notes shape", () => {
        expect(parseInternalUrl(`${ORIGIN}/workspace/notes/unknown/1`)).toMatchObject({
            kind: "route",
        });
    });

    it("falls back to a route when a chatNote has an invalid chat type", () => {
        expect(
            parseInternalUrl(`${ORIGIN}/workspace/notes/chat/xx/5/thread/7/note/30`)
        ).toMatchObject({ kind: "route" });
    });
});

// --------------------------------------------------------------------------
// urlHandler.ts
// --------------------------------------------------------------------------

describe("getDomainFromUrl", () => {
    it("returns the hostname of a valid URL", () => {
        expect(getDomainFromUrl("https://www.example.com/path?q=1")).toBe("www.example.com");
        expect(getDomainFromUrl("http://sub.domain.co.jp:8080/x")).toBe("sub.domain.co.jp");
    });

    it("returns the first 30 chars for an invalid URL", () => {
        const invalid = "not a url at all but quite long indeed";
        expect(getDomainFromUrl(invalid)).toBe(invalid.slice(0, 30));
        expect(getDomainFromUrl(invalid)).toHaveLength(30);
    });

    it("returns the whole short string when it is shorter than 30 chars", () => {
        expect(getDomainFromUrl("just-text")).toBe("just-text");
    });

    it("returns an empty string for an empty input", () => {
        expect(getDomainFromUrl("")).toBe("");
    });
});

// --------------------------------------------------------------------------
// uploadLimits.ts
// --------------------------------------------------------------------------

describe("uploadLimits constants", () => {
    it("caps uploads at 5 MB", () => {
        expect(MAX_UPLOAD_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
        expect(MAX_UPLOAD_FILE_SIZE_LABEL).toBe("5 MB");
    });
});

describe("formatBytes", () => {
    it("formats bytes below 1 KB without decimals", () => {
        expect(formatBytes(0)).toBe("0 B");
        expect(formatBytes(512)).toBe("512 B");
        expect(formatBytes(1023)).toBe("1023 B");
    });

    it("formats kilobytes at the 1 KB boundary with one decimal", () => {
        expect(formatBytes(1024)).toBe("1.0 KB");
        expect(formatBytes(1536)).toBe("1.5 KB");
    });

    it("formats megabytes at the 1 MB boundary with one decimal", () => {
        expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
        expect(formatBytes(MAX_UPLOAD_FILE_SIZE_BYTES)).toBe("5.0 MB");
    });

    it("formats gigabytes at the 1 GB boundary with two decimals", () => {
        expect(formatBytes(1024 * 1024 * 1024)).toBe("1.00 GB");
        expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.50 GB");
    });
});

// Minimal File-like helper. jsdom provides a real `File` constructor.
const makeFile = (name: string, size: number): File => {
    const f = new File(["x"], name, { type: "text/plain" });
    // `File.size` is read-only; redefine for deterministic sizing.
    Object.defineProperty(f, "size", { value: size });
    return f;
};

describe("isFileSizeAllowed", () => {
    it("allows a file at exactly the cap", () => {
        expect(isFileSizeAllowed(makeFile("a.txt", MAX_UPLOAD_FILE_SIZE_BYTES))).toBe(true);
    });

    it("allows a file below the cap", () => {
        expect(isFileSizeAllowed(makeFile("a.txt", 1000))).toBe(true);
        expect(isFileSizeAllowed(makeFile("a.txt", 0))).toBe(true);
    });

    it("rejects a file one byte over the cap", () => {
        expect(isFileSizeAllowed(makeFile("a.txt", MAX_UPLOAD_FILE_SIZE_BYTES + 1))).toBe(false);
    });
});

describe("partitionBySize", () => {
    it("returns null rejected when every file is small enough", () => {
        const files = [makeFile("a.txt", 10), makeFile("b.txt", 20)];
        const result = partitionBySize(files);
        expect(result.accepted).toHaveLength(2);
        expect(result.rejected).toBeNull();
    });

    it("splits a mixed list, keeping order within each group", () => {
        const small1 = makeFile("small1.txt", 100);
        const big1 = makeFile("big1.bin", MAX_UPLOAD_FILE_SIZE_BYTES + 1);
        const small2 = makeFile("small2.txt", 200);
        const big2 = makeFile("big2.bin", MAX_UPLOAD_FILE_SIZE_BYTES * 2);

        const result = partitionBySize([small1, big1, small2, big2]);

        expect(result.accepted).toEqual([small1, small2]);
        expect(result.rejected).toEqual({
            files: [
                { name: "big1.bin", size: MAX_UPLOAD_FILE_SIZE_BYTES + 1 },
                { name: "big2.bin", size: MAX_UPLOAD_FILE_SIZE_BYTES * 2 },
            ],
        });
    });

    it("only retains name and size for rejected files (not the File object)", () => {
        const big = makeFile("big.bin", MAX_UPLOAD_FILE_SIZE_BYTES + 1);
        const result = partitionBySize([big]);
        expect(result.rejected).not.toBeNull();
        expect(result.rejected!.files[0]).toEqual({ name: "big.bin", size: big.size });
        expect(result.rejected!.files[0]).not.toBeInstanceOf(File);
    });

    it("handles an empty iterable", () => {
        const result = partitionBySize([]);
        expect(result.accepted).toEqual([]);
        expect(result.rejected).toBeNull();
    });

    it("accepts any iterable, not just arrays (Set)", () => {
        const f = makeFile("a.txt", 10);
        const result = partitionBySize(new Set([f]));
        expect(result.accepted).toEqual([f]);
        expect(result.rejected).toBeNull();
    });
});

// --------------------------------------------------------------------------
// stringHelper.ts
// --------------------------------------------------------------------------

describe("replaceSpacesWithUnderscore", () => {
    it("replaces a single space with an underscore", () => {
        expect(replaceSpacesWithUnderscore("a b")).toBe("a_b");
    });

    it("collapses a run of whitespace into a single underscore", () => {
        expect(replaceSpacesWithUnderscore("a   b")).toBe("a_b");
        expect(replaceSpacesWithUnderscore("a \t\n b")).toBe("a_b");
    });

    it("replaces leading and trailing whitespace too", () => {
        expect(replaceSpacesWithUnderscore("  hello world  ")).toBe("_hello_world_");
    });

    it("returns the input unchanged when there is no whitespace", () => {
        expect(replaceSpacesWithUnderscore("nospaces")).toBe("nospaces");
    });

    it("returns an empty string for empty input", () => {
        expect(replaceSpacesWithUnderscore("")).toBe("");
    });

    it("converts an all-whitespace string to a single underscore", () => {
        expect(replaceSpacesWithUnderscore("   ")).toBe("_");
        expect(replaceSpacesWithUnderscore("\t\n")).toBe("_");
    });
});
