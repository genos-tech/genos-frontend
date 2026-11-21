/**
 * A deleted account's anonymised sender, read back from the cache on boot, must
 * teach the people directory (MIP-1797).
 *
 * `rememberPeople` ran for live messages and for member rosters, but not for
 * the message rows `hydrateFromIDB` loads. So after a reload the chip that
 * mentions a person whose messages are cached (and who is long gone from the
 * roster) fell back to the real name typed in the text, until a message from
 * them happened to arrive live again.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { forgetEveryone, rememberedPerson } from "../components/ui/avatars/userDirectory";
import { STORES } from "../db/config";
import { channelService } from "../services/channel/channelService";
import { ChannelKind, type Message } from "../types/channel";

const rows = vi.hoisted(() => ({ messages: [] as unknown[] }));
vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockResolvedValue({
        getAll: async (store: string) => (store === "messagesV3" ? rows.messages : []),
    }),
}));

describe("hydrateFromIDB and the people directory", () => {
    afterEach(() => forgetEveryone());

    it("remembers the senders of cached messages, anonymised ones included", async () => {
        expect(STORES.MESSAGES_V3).toBe("messagesV3");
        rows.messages = [
            {
                id: "m1",
                channelId: "c1",
                channelKind: ChannelKind.GM,
                tsSent: "2026-11-21T00:00:00Z",
                sender: {
                    userId: "gone",
                    userName: "Deleted user",
                    userEmail: "deleted-1@deleted.invalid",
                },
            } as unknown as Message,
        ];
        await channelService.hydrateFromIDB();
        expect(rememberedPerson("gone")?.userName).toBe("Deleted user");
    });

    it("a cached message from BEFORE the deletion never puts the real name back", async () => {
        // IDB `getAll` returns rows in key order, not by time: the anonymised row
        // can come first and the stale real-name row second.
        const row = (id: string, userName: string, userEmail: string) =>
            ({
                id,
                channelId: "c1",
                channelKind: ChannelKind.GM,
                tsSent: "2026-11-21T00:00:00Z",
                sender: { userId: "gone", userName, userEmail },
            }) as unknown as Message;
        rows.messages = [
            row("m_a", "Deleted user", "deleted-1@deleted.invalid"),
            row("m_z", "Real Name", "real@example.test"),
        ];
        await channelService.hydrateFromIDB();
        expect(rememberedPerson("gone")?.userName).toBe("Deleted user");
    });
});
