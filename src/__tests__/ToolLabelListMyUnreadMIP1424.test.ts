/**
 * The agent's progress strip names `list_my_unread` for what it does (MIP-1424).
 *
 * The in-app agent now has the unread digest. An unmapped tool name falls back to the raw
 * identifier, which a non-technical person should never read, so the label exists in every
 * locale and is not the raw name.
 */
import { describe, expect, it } from "vitest";

import { getToolLabel } from "../features/agentQA/toolLabels";
import { en } from "../i18n/locales/en";

const CODES = ["en", "ja", "zh", "es", "fr", "hi", "ar"];
const load = async (code: string) => (await import(`../i18n/locales/${code}`))[code] as typeof en;

describe("list_my_unread's progress label", () => {
    it("says what it does in English", () => {
        expect(getToolLabel("list_my_unread", en)).toBe("Checking what you haven't read");
    });

    it.each(CODES)("%s has a label that is not the raw tool name", async (code) => {
        const label = getToolLabel("list_my_unread", await load(code));
        expect(label).not.toBe("list_my_unread");
        expect(label.trim().length).toBeGreaterThan(3);
        if (code !== "en") expect(label).not.toBe(getToolLabel("list_my_unread", en));
    });

    it("sits beside its neighbours: the inbox and chat labels are unchanged", () => {
        expect(getToolLabel("list_my_inbox", en)).toBe("Checking your inbox");
        expect(getToolLabel("list_my_chats", en)).toBe("Finding your chats");
    });
});
