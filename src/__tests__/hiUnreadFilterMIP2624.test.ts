/**
 * MIP-2624: the Hindi "Unread" filter chip read "अपठित ग", a word cut off after
 * its first letter. The label is the whole word, as every other Hindi "unread".
 */
import { describe, expect, it } from "vitest";

import { hi } from "../i18n/locales/hi";

describe("the Hindi Unread filter chip", () => {
    it("reads the whole word", () => {
        expect(hi.chat.sidebar.unreadFilter).toBe("अपठित");
    });
});
