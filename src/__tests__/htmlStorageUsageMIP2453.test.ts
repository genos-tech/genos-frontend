/** HTML storage sizes as Plan & Usage and the plan table write them (MIP-2453). */

import { describe, expect, it } from "vitest";

import { storageLabel } from "../features/billing/storageLabel";
import { en } from "../i18n/locales/en";

const label = (bytes: number) => storageLabel(bytes, en.settings.planUsage, "en");

describe("storageLabel", () => {
    it("writes whole quotas without decimals", () => {
        expect(label(200 * 1024 ** 2)).toBe("200 MB");
        expect(label(1024 ** 3)).toBe("1 GB");
        expect(label(512 * 1024)).toBe("512 KB");
    });

    it("rounds down, so what is left is never overstated", () => {
        expect(label(200 * 1024 ** 2 - 1)).toBe("199.9 MB");
        expect(label(1024 ** 3 - 1)).toBe("1,023.9 MB");
        expect(label(0)).toBe("0 KB");
        expect(label(1)).toBe("1 KB");
    });
});
