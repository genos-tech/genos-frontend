import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    ChatNoteMetaProps,
    MyNoteMetaProps,
    SharedNoteMetaProps,
    TaskNoteMetaProps,
} from "../../types/notes";
import { emptyDmPartnerUser } from "../../utils/defaultProps";
import {
    bumpGMProfileImageVersion,
    useGMProfileImageVersion,
} from "../../utils/gmProfileImageVersion";
import {
    buildChatNoteTree,
    buildMyNoteTree,
    buildSharedNoteTree,
    buildTaskNoteTree,
} from "../../utils/note";
import { areObjectsEqual } from "../../utils/objectHandler";
import { getServiceShortcutModifierKeys, isMac } from "../../utils/platform";
import {
    closeMessagesPane,
    closeSidebar,
    openMessagesPane,
    openSidebar,
    toggleMessagesPane,
    toggleSidebar,
} from "../../utils/sidebarUtils";
import { sleepMilliSeconds } from "../../utils/sleep";

// ---------------------------------------------------------------------------
// avatarSrc.ts
//
// MEDIA_URL is captured at module-load time from import.meta.env, so the
// composed-URL branch must be exercised via vi.stubEnv + vi.resetModules +
// dynamic import. The falsy-input and http(s) branches return before
// touching MEDIA_URL and are env-independent.
// ---------------------------------------------------------------------------
describe("buildAvatarSrc", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    const loadFresh = async () => {
        const mod = await import("../../utils/avatarSrc");
        return mod.buildAvatarSrc;
    };

    it("returns undefined for falsy inputs (null, undefined, empty string)", async () => {
        const buildAvatarSrc = await loadFresh();
        expect(buildAvatarSrc(null)).toBeUndefined();
        expect(buildAvatarSrc(undefined)).toBeUndefined();
        expect(buildAvatarSrc("")).toBeUndefined();
    });

    it("returns the input unchanged when it is already an http(s) URL", async () => {
        vi.stubEnv("VITE_MEDIA_ROOT_DJANGO", "https://media.example.com");
        vi.resetModules();
        const buildAvatarSrc = await loadFresh();
        expect(buildAvatarSrc("http://cdn.test/a.png")).toBe("http://cdn.test/a.png");
        expect(buildAvatarSrc("https://cdn.test/b.png")).toBe("https://cdn.test/b.png");
    });

    it("composes MEDIA_URL + path for a relative path when MEDIA_URL is configured", async () => {
        vi.stubEnv("VITE_MEDIA_ROOT_DJANGO", "https://media.example.com");
        vi.resetModules();
        const buildAvatarSrc = await loadFresh();
        expect(buildAvatarSrc("uploads/avatar.jpg")).toBe(
            "https://media.example.com/uploads/avatar.jpg"
        );
    });

    it("returns undefined for a relative path when MEDIA_URL is not configured", async () => {
        vi.stubEnv("VITE_MEDIA_ROOT_DJANGO", "");
        vi.resetModules();
        const buildAvatarSrc = await loadFresh();
        expect(buildAvatarSrc("uploads/avatar.jpg")).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// gmProfileImageVersion.ts — module-level pub/sub + hook
// ---------------------------------------------------------------------------
describe("gmProfileImageVersion", () => {
    it("returns 0 for a key that has never been bumped", () => {
        const { result } = renderHook(() => useGMProfileImageVersion(1, 1001));
        expect(result.current).toBe(0);
    });

    it("increments the returned version after a bump for the same key", () => {
        const { result } = renderHook(() => useGMProfileImageVersion(2, 2002));
        expect(result.current).toBe(0);
        act(() => {
            bumpGMProfileImageVersion(2, 2002);
        });
        expect(result.current).toBe(1);
        act(() => {
            bumpGMProfileImageVersion(2, 2002);
        });
        expect(result.current).toBe(2);
    });

    it("keys version by chatType:chatId — a bump for a different key leaves this hook's value unchanged", () => {
        const { result } = renderHook(() => useGMProfileImageVersion(3, 3003));
        act(() => {
            bumpGMProfileImageVersion(3, 9999); // same type, different id
        });
        expect(result.current).toBe(0);
        act(() => {
            bumpGMProfileImageVersion(99, 3003); // same id, different type
        });
        expect(result.current).toBe(0);
    });

    it("re-renders all mounted consumers on any bump, each returning its own key's version", () => {
        const a = renderHook(() => useGMProfileImageVersion(4, 4004));
        const b = renderHook(() => useGMProfileImageVersion(5, 5005));
        act(() => {
            bumpGMProfileImageVersion(4, 4004);
        });
        expect(a.result.current).toBe(1);
        // b re-rendered too (listener fired) but its own key was not bumped
        expect(b.result.current).toBe(0);
    });

    it("removes its listener on unmount — a later bump does not throw and is reflected on remount", () => {
        const { result, unmount } = renderHook(() => useGMProfileImageVersion(6, 6006));
        expect(result.current).toBe(0);
        unmount();
        expect(() => {
            act(() => {
                bumpGMProfileImageVersion(6, 6006);
            });
        }).not.toThrow();
        // Versions Map persists at module level, so a fresh mount sees the bumped value
        const { result: result2 } = renderHook(() => useGMProfileImageVersion(6, 6006));
        expect(result2.current).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// objectHandler.ts
// ---------------------------------------------------------------------------
describe("areObjectsEqual", () => {
    it("returns true for deeply equal objects with same key order", () => {
        expect(areObjectsEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    it("returns true for equal nested structures", () => {
        expect(areObjectsEqual({ a: { x: [1, 2] } }, { a: { x: [1, 2] } })).toBe(true);
    });

    it("returns false for objects with different values", () => {
        expect(areObjectsEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it("returns false when key insertion order differs (JSON.stringify is order-sensitive)", () => {
        // Documents the ACTUAL behavior: this implementation is NOT order-insensitive.
        expect(areObjectsEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false);
    });

    it("treats empty objects as equal", () => {
        expect(areObjectsEqual({}, {})).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// sidebarUtils.ts
// ---------------------------------------------------------------------------
describe("sidebarUtils", () => {
    afterEach(() => {
        document.documentElement.removeAttribute("style");
        document.body.removeAttribute("style");
    });

    it("openSidebar sets body overflow hidden and the slideIn custom property", () => {
        openSidebar();
        expect(document.body.style.overflow).toBe("hidden");
        expect(document.documentElement.style.getPropertyValue("--SideNavigation-slideIn")).toBe(
            "1"
        );
    });

    it("closeSidebar removes the slideIn property and body overflow", () => {
        openSidebar();
        closeSidebar();
        expect(document.body.style.overflow).toBe("");
        expect(document.documentElement.style.getPropertyValue("--SideNavigation-slideIn")).toBe(
            ""
        );
    });

    it("openMessagesPane sets body overflow and the MessagesPane slideIn property", () => {
        openMessagesPane();
        expect(document.body.style.overflow).toBe("hidden");
        expect(document.documentElement.style.getPropertyValue("--MessagesPane-slideIn")).toBe(
            "1"
        );
    });

    it("closeMessagesPane removes the MessagesPane slideIn property and body overflow", () => {
        openMessagesPane();
        closeMessagesPane();
        expect(document.body.style.overflow).toBe("");
        expect(document.documentElement.style.getPropertyValue("--MessagesPane-slideIn")).toBe("");
    });

    it("toggleSidebar opens from a clean state", () => {
        toggleSidebar();
        // After toggling from no slideIn, expect it to be open (asserted below
        // against the observed jsdom getComputedStyle behavior).
        expect(document.documentElement.style.getPropertyValue("--SideNavigation-slideIn")).toBe(
            "1"
        );
    });

    it("toggleMessagesPane opens from a clean state", () => {
        toggleMessagesPane();
        expect(document.documentElement.style.getPropertyValue("--MessagesPane-slideIn")).toBe(
            "1"
        );
    });
});

// ---------------------------------------------------------------------------
// note.ts — four structurally identical tree builders
// ---------------------------------------------------------------------------
describe("buildMyNoteTree", () => {
    const mk = (over: Partial<MyNoteMetaProps>): MyNoteMetaProps => ({
        noteType: 0,
        noteId: 0,
        parentNoteId: null,
        title: "n",
        tsUpdated: "2025-01-01 00:00:00",
        ...over,
    });

    it("returns an empty array for empty input", () => {
        expect(buildMyNoteTree([])).toEqual([]);
    });

    it("treats a flat list (no parents) as all roots", () => {
        const roots = buildMyNoteTree([mk({ noteId: 1 }), mk({ noteId: 2 })]);
        expect(roots).toHaveLength(2);
        expect(roots.every((r) => r.children.length === 0)).toBe(true);
    });

    it("nests a child under its parent", () => {
        const roots = buildMyNoteTree([mk({ noteId: 1 }), mk({ noteId: 2, parentNoteId: 1 })]);
        expect(roots).toHaveLength(1);
        expect(roots[0].noteId).toBe(1);
        expect(roots[0].children).toHaveLength(1);
        expect(roots[0].children[0].noteId).toBe(2);
    });

    it("treats an orphan (parentNoteId set but missing from the list) as a root", () => {
        const roots = buildMyNoteTree([mk({ noteId: 5, parentNoteId: 999 })]);
        expect(roots).toHaveLength(1);
        expect(roots[0].noteId).toBe(5);
    });

    it("treats a falsy parentNoteId of 0 as a root (truthiness guard)", () => {
        // The implementation guards with `if (item.parentNoteId && ...)`, so a
        // parentNoteId of 0 is falsy and the item becomes a root even if a
        // note with noteId 0 exists in the map.
        const roots = buildMyNoteTree([mk({ noteId: 0 }), mk({ noteId: 7, parentNoteId: 0 })]);
        expect(roots).toHaveLength(2);
        expect(roots.map((r) => r.noteId).sort((x, y) => x - y)).toEqual([0, 7]);
    });

    it("does not mutate inputs into a shared reference and adds children arrays", () => {
        const input = [mk({ noteId: 1 })];
        const roots = buildMyNoteTree(input);
        expect(roots[0]).not.toBe(input[0]); // spread creates a new node
        expect(roots[0].children).toEqual([]);
    });
});

describe("buildTaskNoteTree", () => {
    const mk = (over: Partial<TaskNoteMetaProps>): TaskNoteMetaProps => ({
        noteType: 0,
        noteId: 0,
        parentNoteId: null,
        projectId: 1,
        taskId: 1,
        title: "t",
        tsUpdated: "2025-01-01 00:00:00",
        ...over,
    });

    it("nests children under parents and keeps unrelated nodes as roots", () => {
        const roots = buildTaskNoteTree([
            mk({ noteId: 1 }),
            mk({ noteId: 2, parentNoteId: 1 }),
            mk({ noteId: 3 }),
        ]);
        expect(roots).toHaveLength(2);
        const parent = roots.find((r) => r.noteId === 1)!;
        expect(parent.children.map((c) => c.noteId)).toEqual([2]);
    });
});

describe("buildChatNoteTree", () => {
    const mk = (over: Partial<ChatNoteMetaProps>): ChatNoteMetaProps => ({
        noteType: 0,
        noteId: 0,
        parentNoteId: null,
        chatType: 1,
        chatId: 1,
        isThread: false,
        threadId: 0,
        title: "c",
        tsUpdated: "2025-01-01 00:00:00",
        ...over,
    });

    it("builds a parent/child tree for chat notes", () => {
        const roots = buildChatNoteTree([
            mk({ noteId: 10 }),
            mk({ noteId: 11, parentNoteId: 10 }),
        ]);
        expect(roots).toHaveLength(1);
        expect(roots[0].children[0].noteId).toBe(11);
    });
});

describe("buildSharedNoteTree", () => {
    const mk = (over: Partial<SharedNoteMetaProps>): SharedNoteMetaProps => ({
        noteType: 0,
        noteId: 0,
        parentNoteId: null,
        title: "s",
        tsUpdated: "2025-01-01 00:00:00",
        ownerId: "u1",
        ownerName: "Owner",
        roleId: 1,
        ...over,
    });

    it("builds a parent/child tree for shared notes", () => {
        const roots = buildSharedNoteTree([
            mk({ noteId: 20 }),
            mk({ noteId: 21, parentNoteId: 20 }),
        ]);
        expect(roots).toHaveLength(1);
        expect(roots[0].children[0].noteId).toBe(21);
    });
});

// ---------------------------------------------------------------------------
// defaultProps.ts — exported constant shape (cheap coverage)
// ---------------------------------------------------------------------------
describe("emptyDmPartnerUser", () => {
    it("has all string fields initialised to empty strings", () => {
        expect(emptyDmPartnerUser).toEqual({
            teamId: "",
            teamName: "",
            userId: "",
            userName: "",
            userEmail: "",
            avatarImgPath: "",
            tsLastSeen: "",
            tsJoined: "",
        });
    });
});

// ---------------------------------------------------------------------------
// platform.ts — isMac reads navigator at call time
// ---------------------------------------------------------------------------
describe("platform", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("isMac returns true when navigator.platform contains 'mac'", () => {
        vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "" });
        expect(isMac()).toBe(true);
    });

    it("isMac returns true when platform is empty but userAgent matches mac os x", () => {
        vi.stubGlobal("navigator", {
            platform: "",
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        });
        expect(isMac()).toBe(true);
    });

    it("isMac returns false for a non-mac platform and userAgent", () => {
        vi.stubGlobal("navigator", {
            platform: "Win32",
            userAgent: "Mozilla/5.0 (Windows NT 10.0)",
        });
        expect(isMac()).toBe(false);
    });

    it("isMac returns false when navigator is undefined", () => {
        vi.stubGlobal("navigator", undefined);
        expect(isMac()).toBe(false);
    });

    it("getServiceShortcutModifierKeys returns Mac keys on mac", () => {
        vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "" });
        expect(getServiceShortcutModifierKeys()).toEqual(["Ctrl", "⌘"]);
    });

    it("getServiceShortcutModifierKeys returns Ctrl+Alt off mac", () => {
        vi.stubGlobal("navigator", { platform: "Win32", userAgent: "Windows" });
        expect(getServiceShortcutModifierKeys()).toEqual(["Ctrl", "Alt"]);
    });
});

// ---------------------------------------------------------------------------
// sleep.ts — controlled with fake timers
// ---------------------------------------------------------------------------
describe("sleepMilliSeconds", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("resolves only after the given number of milliseconds has elapsed", async () => {
        let resolved = false;
        const p = sleepMilliSeconds(100).then(() => {
            resolved = true;
        });

        await vi.advanceTimersByTimeAsync(99);
        expect(resolved).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        await p;
        expect(resolved).toBe(true);
    });

    it("returns a Promise", () => {
        const p = sleepMilliSeconds(0);
        expect(p).toBeInstanceOf(Promise);
        return vi.advanceTimersByTimeAsync(0).then(() => p);
    });
});
