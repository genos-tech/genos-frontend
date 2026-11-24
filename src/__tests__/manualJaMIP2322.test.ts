import { describe, expect, it } from "vitest";

import { ja } from "../i18n/locales/ja";
import enManualJson from "../manual/manual.en.json";
import jaManualJson from "../manual/manual.ja.json";
import {
    buildManual,
    buildSettings,
    checkManual,
    checkParity,
    SETTINGS_REFERENCE_ID,
} from "../manual/manualSource";
import { ALL_GUIDE_IDS } from "../manual/settingsMap";
import { JA_SETTINGS_TEXT } from "../manual/settingsMap.ja";

const load = (files: Record<string, string>) =>
    Object.fromEntries(
        Object.entries(files).map(([path, text]) => [path.split("/").pop() as string, text])
    );

const enFiles = load(
    import.meta.glob("../manual/en/*.md", {
        query: "?raw",
        import: "default",
        eager: true,
    }) as Record<string, string>
);
const jaFiles = load(
    import.meta.glob("../manual/ja/*.md", {
        query: "?raw",
        import: "default",
        eager: true,
    }) as Record<string, string>
);

describe("Japanese manual (MIP-2322)", () => {
    const en = buildManual("en", enFiles);
    const manual = buildManual("ja", jaFiles);

    it("has a Japanese file for every English topic, and no other", () => {
        expect(Object.keys(jaFiles).sort()).toEqual(Object.keys(enFiles).sort());
    });

    it("has no problems and keeps the English structure", () => {
        expect(checkManual(manual)).toEqual([]);
        expect(checkParity(manual, en)).toEqual([]);
    });

    it("flags a translation that drops a section or changes a code token", () => {
        const broken = structuredClone(manual);
        broken.topics[0].markdown = broken.topics[0].markdown.replace(/^## .*$/m, "");
        expect(checkParity(broken, en).join("\n")).toMatch(/headings/);
        const changed = structuredClone(manual);
        const withCode = changed.topics.find((t) => /`[^`]+`/.test(t.markdown));
        if (!withCode) throw new Error("expected a topic with code");
        withCode.markdown = withCode.markdown.replace(/`[^`]+`/, "`x`");
        expect(checkParity(changed, en).join("\n")).toMatch(/code differ/);
    });

    it("has Japanese text for every settings id, and for no other", () => {
        expect(Object.keys(JA_SETTINGS_TEXT).sort()).toEqual([...ALL_GUIDE_IDS].sort());
    });

    it("shows the app's own Japanese tab labels in the generated reference", () => {
        const reference = manual.topics.find((t) => t.id === SETTINGS_REFERENCE_ID);
        for (const s of buildSettings("ja")) {
            expect(reference?.markdown, s.id).toContain(s.label);
        }
        // The Developer tab reads "Developer" in the Japanese UI, so the manual says Developer
        // (MIP-2322): the manual follows the app, never 開発者.
        expect(buildSettings("ja").find((s) => s.id === "developer")?.label).toBe("Developer");
        for (const topic of manual.topics) {
            expect(topic.markdown, topic.id).not.toContain("開発者");
        }
    });

    it("names the controls the way the Japanese UI does", () => {
        // Bold names in the prose are checked by hand against the catalog when the text is
        // written (lead-ins and headings are bold too, so a mechanical check would be noise);
        // these are the ones other topics lean on most.
        const text = manual.topics.map((t) => t.markdown).join("\n");
        for (const label of [ja.common?.modalView?.openFullPage, ja.inbox?.sync?.label]) {
            expect(label).toBeTruthy();
            expect(text).toContain(label as string);
        }
    });

    it("keeps the committed exports in step with the sources (run `npm run manual:export`)", () => {
        expect(JSON.parse(JSON.stringify(manual))).toEqual(jaManualJson);
        expect(JSON.parse(JSON.stringify(en))).toEqual(enManualJson);
    });
});
