/**
 * MIP-1122: one source for what color a task status or priority is.
 *
 * Seven palettes used to disagree (Pending was purple in the table, orange
 * on the dashboard, purple again on milestones). These tests pin the one
 * mapping, that every color it yields is readable, and that the CSS
 * variables it points at really exist in the token stylesheet.
 */

import { describe, expect, it } from "vitest";

import {
    isPriorityName,
    isStatusName,
    PRIORITY_NAMES,
    PRIORITY_TONE,
    priorityTone,
    STATUS_NAMES,
    STATUS_TONE,
    statusTone,
    Tone,
    toneBase,
    toneCss,
    toneJoyColor,
    toneSoftBg,
    toneSolid,
    toneText,
} from "../features/tasks/meta/taskTone";
import { contrast } from "../theme/tokens/color";
import { buildRoles } from "../theme/tokens/roles";
import { buildTokenStylesheet } from "../theme/tokens/tokenStyles";

const TONES: Tone[] = ["info", "warning", "danger", "success", "neutral", "muted"];
const AA = 4.5;

describe("the mapping", () => {
    it("statuses", () => {
        expect(STATUS_TONE).toEqual({
            Open: "info",
            WIP: "warning",
            Blocked: "danger",
            Pending: "neutral",
            Closed: "success",
            Deleted: "muted",
        });
    });

    it("priorities", () => {
        expect(PRIORITY_TONE).toEqual({
            Minimal: "muted",
            Low: "neutral",
            Normal: "info",
            High: "warning",
            Critical: "danger",
        });
    });

    it("every name has a tone, and an unknown value takes the caller's fallback", () => {
        for (const s of STATUS_NAMES) expect(TONES).toContain(statusTone(s));
        for (const p of PRIORITY_NAMES) expect(TONES).toContain(priorityTone(p));
        expect(statusTone("Archived")).toBe("neutral");
        expect(statusTone(undefined, "info")).toBe("info");
        expect(priorityTone("Medium")).toBe("neutral"); // a legacy label
        expect(statusTone("  WIP ")).toBe("warning");
    });

    it.each(["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"])(
        "%j is not a status or a priority (strings from the backend or an LLM must not find inherited members)",
        (name) => {
            expect(isStatusName(name)).toBe(false);
            expect(isPriorityName(name)).toBe(false);
            expect(statusTone(name)).toBe("neutral");
            expect(priorityTone(name, "info")).toBe("info");
        }
    );

    it("Deleted and Minimal ARE known, though their tone is the muted one", () => {
        // "is the tone not muted?" is not "is it a status": it dropped both.
        expect(isStatusName("Deleted")).toBe(true);
        expect(isPriorityName("Minimal")).toBe(true);
        expect(statusTone("Deleted")).toBe("muted");
        expect(isStatusName("")).toBe(false);
        expect(isStatusName(undefined)).toBe(false);
        expect(isStatusName(" WIP ")).toBe(true);
    });

    it("the tones that tell people to act are not shared with calm ones", () => {
        // Blocked and Critical are the only reds; Closed the only green.
        const reds = [...STATUS_NAMES, ...PRIORITY_NAMES].filter(
            (n) => statusTone(n, "muted") === "danger" || priorityTone(n, "muted") === "danger"
        );
        expect(reds.sort()).toEqual(["Blocked", "Critical"]);
    });
});

describe.each(TONES)("tone: %s", (tone) => {
    it("a solid fill carries its label color at AA", () => {
        const { bg, fg } = toneSolid(tone);
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA);
    });

    it("the hue as text or an icon is readable on the surfaces it sits on", () => {
        for (const mode of ["light", "dark"] as const) {
            const roles = buildRoles("purple", mode);
            const text = toneText(tone, mode === "dark");
            // `muted` is meta (3:1), like the tertiary text role it comes from.
            const min = tone === "muted" ? 3 : AA;
            for (const surface of [roles.bg, roles.bgSubtle, roles.surface, roles.surfaceRaised]) {
                expect(
                    contrast(text, surface),
                    `${tone} ${mode} on ${surface}`
                ).toBeGreaterThanOrEqual(min);
            }
        }
    });

    it("the soft background keeps the rgba(r, g, b, a) shape callers rewrite by string", () => {
        const soft = toneSoftBg(tone, 0.12);
        expect(soft).toMatch(/^rgba\(\d+, \d+, \d+, 0\.12\)$/);
        expect(soft.replace("0.12", "0.08")).toMatch(/0\.08\)$/);
        expect(toneBase(tone)).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it("every CSS variable it points at exists in the token stylesheet", () => {
        const css = buildTokenStylesheet();
        const refs = Object.values(toneCss(tone)).flatMap((v) =>
            Array.from(v.matchAll(/var\((--g-[a-z-]+)\)/g), (m) => m[1])
        );
        expect(refs.length).toBeGreaterThan(0);
        for (const name of refs) expect(css, name).toContain(`${name}:`);
    });
});

describe("Joy color prop", () => {
    it("Open maps to primary (Joy has no info), danger and success to themselves", () => {
        expect(toneJoyColor("info")).toBe("primary");
        expect(toneJoyColor("danger")).toBe("danger");
        expect(toneJoyColor("success")).toBe("success");
        expect(toneJoyColor("neutral")).toBe("neutral");
        expect(toneJoyColor("muted")).toBe("neutral");
    });
});
