import { describe, expect, it } from "vitest";

import enManualJson from "../manual/manual.en.json";
import {
    buildManual,
    buildSettings,
    checkManual,
    parseTopic,
    SETTINGS_REFERENCE_ID,
} from "../manual/manualSource";
import { ALL_GUIDE_IDS } from "../manual/settingsMap";

const enFiles = import.meta.glob("../manual/en/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

const byName = Object.fromEntries(
    Object.entries(enFiles).map(([path, text]) => [path.split("/").pop() as string, text])
);

describe("manual source (MIP-2321)", () => {
    const manual = buildManual("en", byName);

    it("parses front matter and rejects a topic without it", () => {
        const topic = parseTopic(
            "x.md",
            "---\nid: a-b\ntitle: A: b\nsettings: [general, chat.x]\n---\n\n## H\ntext\n"
        );
        expect(topic).toEqual({
            id: "a-b",
            title: "A: b",
            settings: ["general", "chat.x"],
            markdown: "## H\ntext\n",
        });
        expect(() => parseTopic("bad.md", "## no front matter")).toThrow(/front matter/);
        expect(() => parseTopic("bad.md", "---\nid: Bad Id\ntitle: t\n---\n")).toThrow(/kebab/);
    });

    it("has the topics the task lists: 17 guide topics, 2 company notes, Security, generated A-Z", () => {
        const ids = manual.topics.map((t) => t.id);
        expect(ids).toContain("security");
        expect(ids).toContain("company-organising");
        expect(ids).toContain("company-setup");
        expect(ids).toContain(SETTINGS_REFERENCE_ID);
        // 17 guide topics + 2 company + security = 20 files, plus the generated reference.
        expect(manual.topics.length).toBe(21);
    });

    it("has no problems: unique ids, known settings ids, no TODO or dated text", () => {
        expect(checkManual(manual)).toEqual([]);
    });

    it("has a section for every settings id (tab or row)", () => {
        // The generated reference lists every id by construction, so it does not count here:
        // a written topic has to explain each tab and row.
        const covered = new Set(
            manual.topics.filter((t) => t.id !== SETTINGS_REFERENCE_ID).flatMap((t) => t.settings)
        );
        const reference = manual.topics.find((t) => t.id === SETTINGS_REFERENCE_ID);
        expect(reference?.markdown).toBeTruthy();
        for (const id of ALL_GUIDE_IDS) {
            expect(covered.has(id), `settings id ${id} is in no topic`).toBe(true);
        }
        // Every tab label and row name appears in the generated reference.
        for (const s of buildSettings()) {
            expect(reference?.markdown, s.id).toContain(s.label);
        }
    });

    it("keeps the committed export in step with the source (run `npm run manual:export`)", () => {
        expect(JSON.parse(JSON.stringify(manual))).toEqual(enManualJson);
    });
});
