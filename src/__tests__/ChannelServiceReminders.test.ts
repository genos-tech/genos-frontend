/**
 * channelService — the reminder half of "a flag with a time on it".
 *
 * Covers the three couplings the feature depends on, each of which is a
 * user-visible lie if it breaks: setting a reminder also flags the message,
 * losing the flag drops the reminder (mirroring the server cascade), and a
 * refused DELETE puts the reminder back rather than leaving the UI claiming
 * a cancellation that never happened.
 *
 * Same harness as `channelService.test.ts`: IDB stubbed off, axios.create
 * spied, warnings silenced.
 */

import axios from "axios";
import { afterAll, describe, expect, it, vi } from "vitest";

import { ChannelService } from "../services/channel/channelService";
import type { Flag, MessageReminder } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

const REMIND_AT = "2026-08-05T09:00:00Z";

const reminder = (messageId: string, remindAt = REMIND_AT): MessageReminder => ({
    id: `rem-${messageId}`,
    messageId,
    remindAt,
    tsCreated: "2026-08-04T09:00:00Z",
});

const flag = (messageId: string): Flag => ({
    id: `flag-${messageId}`,
    messageId,
    tsCreated: "2026-08-04T09:00:00Z",
});

/** A service with a token and a stubbed HTTP client. */
const makeService = (http: Record<string, unknown>) => {
    const svc = new ChannelService();
    svc.setCurrentUserId("user-me");
    svc.setAccessToken("tok-1");
    vi.spyOn(axios, "create").mockReturnValue(http as never);
    return svc;
};

describe("channelService.setReminder", () => {
    it("stores the reminder and flags the message", async () => {
        const post = vi.fn().mockResolvedValue({ data: { reminder: reminder("m-1") } });
        const svc = makeService({ post });
        // The flag itself rides the socket, which a unit test has none of;
        // what matters here is that setting a reminder asks for it, since
        // that is what puts the message in the flagged list.
        const flagMessage = vi.spyOn(svc, "flagMessage").mockResolvedValue(flag("m-1"));

        await svc.setReminder("m-1", new Date(REMIND_AT));

        expect(post).toHaveBeenCalledWith("/api/v3/messages/m-1/reminder/", {
            remindAt: new Date(REMIND_AT).toISOString(),
        });
        expect(svc.getSnapshot().reminderByMessageId.get("m-1")?.remindAt).toBe(REMIND_AT);
        expect(flagMessage).toHaveBeenCalledWith("m-1");
    });

    it("leaves an existing flag alone rather than re-emitting", async () => {
        const post = vi.fn().mockResolvedValue({ data: { reminder: reminder("m-1") } });
        const svc = makeService({ post });
        svc.handleFlagAdded(flag("m-1"));
        const spy = vi.spyOn(svc, "flagMessage");

        await svc.setReminder("m-1", new Date(REMIND_AT));

        expect(spy).not.toHaveBeenCalled();
    });

    it("keeps no reminder when the server refuses the time", async () => {
        const post = vi.fn().mockRejectedValue(new Error("400 remindAt must be in the future"));
        const svc = makeService({ post });

        await expect(svc.setReminder("m-1", new Date("2020-01-01T00:00:00Z"))).rejects.toThrow();
        expect(svc.getSnapshot().reminderByMessageId.has("m-1")).toBe(false);
    });
});

describe("channelService.cancelReminder", () => {
    it("drops it locally and calls the endpoint", async () => {
        const post = vi.fn().mockResolvedValue({ data: { reminder: reminder("m-1") } });
        const del = vi.fn().mockResolvedValue({ data: {} });
        const svc = makeService({ post, delete: del });
        vi.spyOn(svc, "flagMessage").mockResolvedValue(flag("m-1"));
        await svc.setReminder("m-1", new Date(REMIND_AT));

        await svc.cancelReminder("m-1");

        expect(del).toHaveBeenCalledWith("/api/v3/messages/m-1/reminder/");
        expect(svc.getSnapshot().reminderByMessageId.has("m-1")).toBe(false);
    });

    it("restores it when the request fails", async () => {
        const post = vi.fn().mockResolvedValue({ data: { reminder: reminder("m-1") } });
        const del = vi.fn().mockRejectedValue(new Error("network down"));
        const svc = makeService({ post, delete: del });
        vi.spyOn(svc, "flagMessage").mockResolvedValue(flag("m-1"));
        await svc.setReminder("m-1", new Date(REMIND_AT));

        await expect(svc.cancelReminder("m-1")).rejects.toThrow();
        expect(svc.getSnapshot().reminderByMessageId.get("m-1")?.remindAt).toBe(REMIND_AT);
    });
});

describe("channelService.fetchReminders", () => {
    it("reconciles rather than merges", async () => {
        const get = vi.fn().mockResolvedValue({ data: { reminders: [reminder("m-2")] } });
        const post = vi.fn().mockResolvedValue({ data: { reminder: reminder("m-1") } });
        const svc = makeService({ get, post });
        vi.spyOn(svc, "flagMessage").mockResolvedValue(flag("m-1"));
        await svc.setReminder("m-1", new Date(REMIND_AT));

        await svc.fetchReminders();

        // m-1 was cancelled on another device: it must not survive the load.
        expect(svc.getSnapshot().reminderByMessageId.has("m-1")).toBe(false);
        expect(svc.getSnapshot().reminderByMessageId.has("m-2")).toBe(true);
    });

    it("keeps what it has when the request fails", async () => {
        const get = vi.fn().mockRejectedValue(new Error("offline"));
        const post = vi.fn().mockResolvedValue({ data: { reminder: reminder("m-1") } });
        const svc = makeService({ get, post });
        vi.spyOn(svc, "flagMessage").mockResolvedValue(flag("m-1"));
        await svc.setReminder("m-1", new Date(REMIND_AT));

        await svc.fetchReminders();

        expect(svc.getSnapshot().reminderByMessageId.has("m-1")).toBe(true);
    });
});

describe("reminders follow the flag", () => {
    /** A service holding one reminder on `m-1`, no HTTP left to do. */
    const withReminder = async () => {
        const post = vi.fn().mockResolvedValue({ data: { reminder: reminder("m-1") } });
        const svc = makeService({ post });
        vi.spyOn(svc, "flagMessage").mockResolvedValue(flag("m-1"));
        await svc.setReminder("m-1", new Date(REMIND_AT));
        svc.handleFlagAdded(flag("m-1"));
        expect(svc.getSnapshot().reminderByMessageId.has("m-1")).toBe(true);
        return svc;
    };

    it("drops the reminder when the flag is completed", async () => {
        const svc = await withReminder();
        svc.handleFlagCompleted({ ...flag("m-1"), completedAt: "2026-08-04T10:00:00Z" });
        expect(svc.getSnapshot().reminderByMessageId.has("m-1")).toBe(false);
    });

    it("drops the reminder when the message is unflagged", async () => {
        const svc = await withReminder();
        svc.handleFlagRemoved("m-1");
        expect(svc.getSnapshot().reminderByMessageId.has("m-1")).toBe(false);
    });

    it("bumps remindersVersion so subscribers see in-place Map changes", async () => {
        const svc = await withReminder();
        const before = svc.getSnapshot().remindersVersion;
        svc.handleFlagRemoved("m-1");
        expect(svc.getSnapshot().remindersVersion).toBeGreaterThan(before);
    });
});

describe("the sweep after a reminder comes due", () => {
    it("re-reads the pending set once the time has passed", async () => {
        vi.useFakeTimers();
        try {
            const soon = new Date(Date.now() + 60_000).toISOString();
            const post = vi.fn().mockResolvedValue({ data: { reminder: reminder("m-1", soon) } });
            // The server has since fired it, so it is no longer pending.
            const get = vi.fn().mockResolvedValue({ data: { reminders: [] } });
            const svc = makeService({ get, post });
            vi.spyOn(svc, "flagMessage").mockResolvedValue(flag("m-1"));
            await svc.setReminder("m-1", new Date(soon));
            expect(get).not.toHaveBeenCalled();

            // Past its time plus the grace window the tick needs.
            await vi.advanceTimersByTimeAsync(60_000 + 90_000 + 1000);

            expect(get).toHaveBeenCalledWith("/api/v3/reminders/");
            expect(svc.getSnapshot().reminderByMessageId.has("m-1")).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it("arms nothing when there is no reminder left", async () => {
        vi.useFakeTimers();
        try {
            const soon = new Date(Date.now() + 60_000).toISOString();
            const post = vi.fn().mockResolvedValue({ data: { reminder: reminder("m-1", soon) } });
            const del = vi.fn().mockResolvedValue({ data: {} });
            const get = vi.fn().mockResolvedValue({ data: { reminders: [] } });
            const svc = makeService({ get, post, delete: del });
            vi.spyOn(svc, "flagMessage").mockResolvedValue(flag("m-1"));
            await svc.setReminder("m-1", new Date(soon));
            await svc.cancelReminder("m-1");

            await vi.advanceTimersByTimeAsync(24 * 3600_000);

            expect(get).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("team switch", () => {
    it("clears reminders, which are as team-scoped as their flags", async () => {
        const post = vi.fn().mockResolvedValue({ data: { reminder: reminder("m-1") } });
        const svc = makeService({ post });
        vi.spyOn(svc, "flagMessage").mockResolvedValue(flag("m-1"));
        await svc.setReminder("m-1", new Date(REMIND_AT));

        svc.setCurrentTeamId("team-a");
        svc.setCurrentTeamId("team-b");

        expect(svc.getSnapshot().reminderByMessageId.size).toBe(0);
    });
});
