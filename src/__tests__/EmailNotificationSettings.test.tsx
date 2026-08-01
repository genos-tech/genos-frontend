/**
 * Email-channel settings (F1 of the email notification series):
 *
 *  - `useReportUiLanguage` — the boot/locale-change sync of
 *    `CustomUser.language` (mirrors ReportBrowserTimezone.test.tsx).
 *  - The email preference plumbing: `email_enabled` wire mapping and the
 *    manager writing `email:`-prefixed SERVER-vocabulary keys into the
 *    full `categorySettings` map — never client keys, never a delta.
 *  - The registry stays server-vocabulary-only (no client-only fine keys
 *    like `mention_task_body` may ever appear in it).
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shouldReportLanguage, useReportUiLanguage } from "../hooks/common/useReportUiLanguage";
import {
    EMAIL_CATEGORIES,
    isEmailCategoryEnabled,
} from "../services/notifications/emailCategories";
import { toWire } from "../services/notifications/notificationApi";
import { NotificationManager } from "../services/notifications/notificationManager";

const get = vi.fn();
const patch = vi.fn();
let hasApi = true;
let activeLocale = "ja";

vi.mock("../services/api", () => ({
    authApi: () => (hasApi ? { get, patch } : null),
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "token" }),
}));
vi.mock("../i18n", () => ({
    useTranslation: () => ({ locale: activeLocale }),
}));

beforeEach(() => {
    hasApi = true;
    activeLocale = "ja";
    get.mockResolvedValue({ data: { language: "" } });
    patch.mockResolvedValue({ data: { language: "ja" } });
});

afterEach(() => vi.clearAllMocks());

describe("shouldReportLanguage", () => {
    it("reports when the server has never been told", () => {
        expect(shouldReportLanguage({ active: "ja", stored: "" })).toBe(true);
    });

    it("stays quiet when they already agree", () => {
        expect(shouldReportLanguage({ active: "ja", stored: "ja" })).toBe(false);
    });

    it("stays quiet with no active locale", () => {
        expect(shouldReportLanguage({ active: "", stored: "ja" })).toBe(false);
    });
});

describe("useReportUiLanguage", () => {
    it("PATCHes the active locale when the server has none", async () => {
        renderHook(() => useReportUiLanguage());
        await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
        expect(patch).toHaveBeenCalledWith("/user/preferences/language/", {
            language: "ja",
        });
    });

    it("does not PATCH when the server already agrees", async () => {
        get.mockResolvedValue({ data: { language: "ja" } });
        renderHook(() => useReportUiLanguage());
        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(patch).not.toHaveBeenCalled();
    });

    it("stays silent when the GET fails — English fallback keeps working", async () => {
        get.mockRejectedValue(new Error("offline"));
        renderHook(() => useReportUiLanguage());
        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(patch).not.toHaveBeenCalled();
    });

    it("does nothing when unauthenticated", async () => {
        hasApi = false;
        renderHook(() => useReportUiLanguage());
        await Promise.resolve();
        expect(get).not.toHaveBeenCalled();
    });
});

describe("email preference wire mapping", () => {
    it("round-trips emailEnabled as email_enabled", () => {
        expect(toWire({ emailEnabled: false })).toEqual({ email_enabled: false });
        // Omitted when not in the patch (partial update).
        expect(toWire({ masterEnabled: true })).not.toHaveProperty("email_enabled");
    });
});

describe("NotificationManager email setters", () => {
    const makeManager = () => {
        const patches: Array<Record<string, unknown>> = [];
        const manager = new NotificationManager({
            currentUserId: "u1",
            onPreferencesChange: (p) => patches.push(p as Record<string, unknown>),
        });
        return { manager, patches };
    };

    it("setEmailCategoryEnabled writes the prefixed key into the FULL map", () => {
        const { manager, patches } = makeManager();
        manager.setSubCategoryEnabled("mention_chat", false);
        manager.setEmailCategoryEnabled("mention_task", false);
        const last = patches[patches.length - 1];
        // Full map: the earlier unprefixed key survives beside the new one.
        expect(last.categorySettings).toEqual({
            mention_chat: false,
            "email:mention_task": false,
        });
    });

    it("setEmailEnabled patches only the email master", () => {
        const { manager, patches } = makeManager();
        manager.setEmailEnabled(false);
        expect(patches[patches.length - 1]).toEqual({ emailEnabled: false });
        expect(manager.getPreferences().emailEnabled).toBe(false);
        // In-app/push masters untouched.
        expect(manager.getPreferences().masterEnabled).toBe(true);
    });
});

describe("email category registry", () => {
    it("contains only SERVER-vocabulary keys", () => {
        // The client's finer keys must never leak into email toggles — the
        // server can't read them (`mention_task_body` would gate nothing).
        const clientOnly = [
            "mention_task_body",
            "mention_task_comment",
            "mention_note_my",
            "mention_note_task",
            "mention_note_chat",
        ];
        for (const entry of EMAIL_CATEGORIES) {
            expect(clientOnly).not.toContain(entry.serverKey);
        }
    });

    it("resolves stored overrides over defaults", () => {
        const chats = EMAIL_CATEGORIES.find((e) => e.serverKey === "chats")!;
        expect(isEmailCategoryEnabled({}, chats)).toBe(false);
        expect(isEmailCategoryEnabled({ "email:chats": true }, chats)).toBe(true);
        // Unprefixed keys are ignored for the email channel.
        expect(isEmailCategoryEnabled({ chats: true }, chats)).toBe(false);
    });
});
