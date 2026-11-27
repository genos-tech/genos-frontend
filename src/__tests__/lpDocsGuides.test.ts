/**
 * The /docs visual guides (MIP-2415): every picture a guide names exists in every language, and
 * the numbered words under it match the numbered dots the screenshot script measured.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { GUIDES } from "../lp/guides/guides";
import { GUIDE_SHOTS } from "../lp/guides/guideShots";
import manualEn from "../manual/manual.en.json";

const LANGS = ["en", "ja"] as const;
const file = (path: string) => join(process.cwd(), "public", path);
const topics = Object.entries(GUIDES);

describe("docs visual guides", () => {
    it("guides every manual topic that is not a reference table, and no unknown one", () => {
        const manual = manualEn.topics
            .map((t) => t.id)
            .filter((id) => id !== "settings-reference");
        expect(Object.keys(GUIDES).sort()).toEqual(manual.sort());
    });

    it.each(topics)("%s", (_topic, steps) => {
        for (const step of steps) {
            for (const lang of LANGS) {
                const text = step[lang];
                expect(text.title).toBeTruthy();
                expect(step.shot || step.lpShot || text.flow, text.title).toBeTruthy();
                if (step.lpShot) {
                    expect(existsSync(file(`lp/shots/${lang}/${step.lpShot}.webp`))).toBe(true);
                }
                if (!step.shot) {
                    expect(text.pins).toBeUndefined();
                    continue;
                }
                for (const suffix of [".webp", "@2x.webp"]) {
                    const path = `lp/guide/${lang}/${step.shot}${suffix}`;
                    expect(existsSync(file(path)), path).toBe(true);
                }
                const dots = GUIDE_SHOTS[step.shot]?.[lang]?.pins.length;
                expect(text.pins?.length ?? 0, `${lang}/${step.shot}`).toBe(dots);
            }
        }
    });
});
