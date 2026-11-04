/**
 * The BlockNote compatibility check (MIP-1008), on a synthetic document set.
 *
 * `devtools/blocknoteCompat` reads a stored document the way the editors do and
 * reduces what the installed BlockNote makes of it to comparable data. The real
 * run, over production documents, cannot live in the repo. This is the part
 * that can: a synthetic set that uses every block type, inline chip and style
 * the editors write, stored both as block JSON and as Yjs updates WRITTEN BY
 * BLOCKNOTE 0.49, plus the result 0.49 gives for each (the golden file).
 *
 * That makes it a tripwire for an upgrade. On 0.57, the Yjs bytes written by
 * 0.49 must read to the same blocks, the same round trip and the same markdown.
 * When one does not, this fails with the differing data. A difference that is
 * wanted (a new default prop, a changed export) is accepted on purpose by
 * regenerating the golden file and saying why in the PR:
 *
 *   UPDATE_COMPAT_GOLDEN=1 npx vitest run src/__tests__/blocknoteCompat.test.ts
 *   npx prettier --write src/__tests__/fixtures/blocknoteCompat
 *
 * Do not regenerate it to make a red run green without reading the diff.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { blocksToYXmlFragment } from "@blocknote/core/yjs";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
    createHeadlessNoteEditor,
    createHeadlessNoteSchema,
} from "../components/editors/headlessNoteSchema";
import {
    canonical,
    checkDocument,
    diffManifests,
    FRAGMENT_NAME,
    readBlockJson,
    readYjsUpdate,
    roundTripThroughYjs,
    sha256,
    toManifestEntry,
    type CompatDoc,
    type CompatInput,
    type ManifestEntry,
} from "../devtools/blocknoteCompat/compat";

const FIXTURES = join(__dirname, "fixtures", "blocknoteCompat");
const ROOT = join(__dirname, "..", "..");

type FixtureDoc = { name: string; blocks: unknown[] };
const fixtureDocs = (
    JSON.parse(readFileSync(join(FIXTURES, "synthetic.json"), "utf8")) as { docs: FixtureDoc[] }
).docs;

/** Yjs updates written by BlockNote 0.49 from the fixture blocks. Committed, so a
 *  later BlockNote reads what an EARLIER one wrote. */
const yjsPath = join(FIXTURES, "synthetic.yjs.json");
const goldenPath = join(FIXTURES, "synthetic.golden.json");

const writeYjsFixtures = () => {
    const holder = createHeadlessNoteEditor();
    const docs = fixtureDocs.map(({ name, blocks }) => {
        const doc = new Y.Doc();
        blocksToYXmlFragment(
            holder,
            (blocks.length > 0 ? blocks : [{ type: "paragraph" }]) as never,
            doc.getXmlFragment(FRAGMENT_NAME)
        );
        return { name, data: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64") };
    });
    writeFileSync(yjsPath, JSON.stringify({ writtenBy: "@blocknote/core 0.49.0", docs }, null, 2));
};

const loadYjs = () =>
    (JSON.parse(readFileSync(yjsPath, "utf8")) as { docs: { name: string; data: string }[] }).docs;

const inputs = (): CompatInput[] => [
    ...fixtureDocs.map(({ name, blocks }): CompatInput => ({ kind: "blocks", name, blocks })),
    ...loadYjs().map(
        ({ name, data }): CompatInput => ({
            kind: "yjs",
            name: `${name}:yjs`,
            update: Buffer.from(data, "base64"),
        })
    ),
];

const readAll = async (): Promise<CompatDoc[]> => {
    const results: CompatDoc[] = [];
    for (const input of inputs()) results.push(await checkDocument(input));
    return results;
};

if (process.env.UPDATE_COMPAT_GOLDEN) {
    describe("update the golden file", () => {
        it("regenerates the Yjs fixtures only when they are missing, then the golden", async () => {
            try {
                readFileSync(yjsPath);
            } catch {
                writeYjsFixtures();
            }
            const results = await readAll();
            writeFileSync(
                goldenPath,
                JSON.stringify({ readWith: "@blocknote/core 0.49.0", docs: results }, null, 2)
            );
            expect(results.every((r) => r.ok)).toBe(true);
        }, 60000);
    });
}

type Inline = { type: string; styles?: Record<string, unknown>; content?: Inline[] };
type Cell = Inline[] | { content: Inline[] };
type Block = {
    type: string;
    content?: Inline[] | { rows: { cells: Cell[] }[] };
    children?: unknown;
};

/** Every block type, inline type and text style a list of blocks uses. */
const collect = (blocks: unknown) => {
    const types = new Set<string>();
    const inline = new Set<string>();
    const styles = new Set<string>();
    const visit = (list: unknown) => {
        if (!Array.isArray(list)) return;
        for (const block of list as Block[]) {
            types.add(block.type);
            const content = block.content;
            const inlines: Inline[] = Array.isArray(content)
                ? content
                : (content?.rows ?? []).flatMap((row) =>
                      row.cells.flatMap((cell) => (Array.isArray(cell) ? cell : cell.content))
                  );
            for (const node of inlines) {
                inline.add(node.type);
                for (const item of node.type === "link" ? (node.content ?? []) : [node]) {
                    for (const style of Object.keys(item.styles ?? {})) styles.add(style);
                }
            }
            visit(block.children);
        }
    };
    visit(blocks);
    return { types, inline, styles };
};

describe("the synthetic fixture", () => {
    const schema = createHeadlessNoteSchema();
    const seen = collect(fixtureDocs.flatMap((d) => d.blocks));

    it("uses every block type the note editors register", () => {
        const registered = Object.keys(schema.blockSpecs).sort();

        expect(registered.filter((type) => !seen.types.has(type))).toEqual([]);
    });

    it("uses every inline type the note editors register (text, link and the seven chips)", () => {
        const registered = Object.keys(schema.inlineContentSpecs).sort();

        expect(registered.filter((type) => !seen.inline.has(type))).toEqual([]);
    });

    it("uses every text style", () => {
        const registered = Object.keys(schema.styleSpecs).sort();

        expect(registered.filter((style) => !seen.styles.has(style))).toEqual([]);
    });

    it("has a Yjs update for each document, written by 0.49", () => {
        expect(loadYjs().map((d) => d.name)).toEqual(fixtureDocs.map((d) => d.name));
    });
});

describe("what the installed BlockNote makes of the fixture", () => {
    it("reads every document", async () => {
        const results = await readAll();

        expect(results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.error}`)).toEqual([]);
    });

    it("matches the golden result of 0.49, document by document", async () => {
        const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as { docs: CompatDoc[] };
        const results = await readAll();

        expect(results.map((r) => r.name)).toEqual(golden.docs.map((d) => d.name));
        for (const result of results) {
            const expected = golden.docs.find((d) => d.name === result.name);
            expect(result, result.name).toEqual(expected);
        }
    }, 60000);

    it("reads a Yjs update the same as the block JSON it came from", async () => {
        const results = await readAll();
        const byName = new Map(results.map((r) => [r.name, r]));

        for (const { name, blocks } of fixtureDocs) {
            // Block JSON without ids gets made-up ones, so only documents that have
            // ids can be compared with their Yjs form.
            if (byName.get(name)?.idsGenerated) continue;
            expect(byName.get(`${name}:yjs`)?.blocksHash, name).toBe(byName.get(name)?.blocksHash);
            expect(blocks).toBeDefined();
        }
    });

    it("writes the document back to Yjs and reads it unchanged", async () => {
        const results = await readAll();

        expect(results.filter((r) => r.ok && !r.roundTrip?.equal).map((r) => r.name)).toEqual([]);
    });
});

describe("the three readers", () => {
    const partial = [{ type: "paragraph", content: "short form" }];

    it("readBlockJson fills in what BlockNote fills in: ids, default props, text styles, children", () => {
        const [block] = readBlockJson(partial) as Record<string, unknown>[];

        expect(typeof block.id).toBe("string");
        expect(block.props).toEqual({
            backgroundColor: "default",
            textColor: "default",
            textAlignment: "left",
        });
        expect(block.content).toEqual([{ type: "text", text: "short form", styles: {} }]);
        expect(block.children).toEqual([]);
    });

    it("roundTripThroughYjs goes through the schema, not around it", () => {
        // Short-form input only comes back full if it really was written into a
        // Yjs fragment and read out again.
        const [block] = roundTripThroughYjs(partial as unknown[]) as Record<string, unknown>[];

        expect(typeof block.id).toBe("string");
        expect(block.children).toEqual([]);
        expect((block.props as Record<string, unknown>).textAlignment).toBe("left");
    });

    it("readYjsUpdate reads the fragment the editors bind, and nothing else", () => {
        const holder = createHeadlessNoteEditor();
        const blocks = [{ id: "kept", type: "paragraph", content: "in the right place" }];
        const bound = new Y.Doc();
        blocksToYXmlFragment(holder, blocks as never, bound.getXmlFragment(FRAGMENT_NAME));
        const elsewhere = new Y.Doc();
        blocksToYXmlFragment(holder, blocks as never, elsewhere.getXmlFragment("some-other-name"));

        const read = readYjsUpdate(Y.encodeStateAsUpdate(bound)) as { id: string }[];
        const missed = readYjsUpdate(Y.encodeStateAsUpdate(elsewhere)) as { id: string }[];

        expect(read.map((b) => b.id)).toEqual(["kept"]);
        expect(missed.map((b) => b.id)).not.toContain("kept");
    });
});

describe("the checker", () => {
    it("records a document it cannot read instead of throwing, and says which step failed", async () => {
        const result = await checkDocument({
            kind: "blocks",
            name: "bad",
            blocks: [{ id: "x", type: "no-such-block", props: {}, children: [] }],
        });

        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/^read: /);
        expect(result.blocks).toBeUndefined();
    });

    it("records bytes that are not a Yjs update the same way", async () => {
        const result = await checkDocument({
            kind: "yjs",
            name: "garbage",
            update: new Uint8Array([255, 255, 255, 255, 255]),
        });

        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/^read: /);
    });

    it("leaves made-up ids out when the stored JSON had none, so two runs agree", async () => {
        const noIds = [{ type: "paragraph", content: "no id on me" }];

        const first = await checkDocument({ kind: "blocks", name: "a", blocks: noIds });
        const second = await checkDocument({ kind: "blocks", name: "a", blocks: noIds });

        expect(first.idsGenerated).toBe(true);
        expect(first.blocksHash).toBe(second.blocksHash);
        expect(first.roundTrip?.hash).toBe(second.roundTrip?.hash);
        expect(JSON.stringify(first.blocks)).not.toContain('"id"');
    });

    it("keeps the ids of JSON that has them", async () => {
        const withIds = [{ id: "keep-me", type: "paragraph", content: "x", children: [] }];

        const result = await checkDocument({ kind: "blocks", name: "a", blocks: withIds });

        expect(result.idsGenerated).toBeUndefined();
        expect((result.blocks as { id: string }[])[0].id).toBe("keep-me");
    });

    it("treats an empty body as one empty paragraph, as the editors do", async () => {
        for (const blocks of [[], null, undefined]) {
            const result = await checkDocument({ kind: "blocks", name: "empty", blocks });

            expect(result.ok).toBe(true);
            expect(result.types).toEqual({ paragraph: 1 });
        }
    });

    it("prints the same text for the same data whatever the key order", () => {
        expect(canonical({ b: 1, a: { d: 2, c: [{ y: 1, x: 2 }] } })).toBe(
            canonical({ a: { c: [{ x: 2, y: 1 }], d: 2 }, b: 1 })
        );
        expect(sha256("x")).toHaveLength(64);
    });

    it("changes a hash when a prop changes, so a real difference cannot hide", async () => {
        const make = (checked: boolean) => [
            { id: "c", type: "checkListItem", props: { checked }, content: "t", children: [] },
        ];

        const a = await checkDocument({ kind: "blocks", name: "d", blocks: make(true) });
        const b = await checkDocument({ kind: "blocks", name: "d", blocks: make(false) });

        expect(a.blocksHash).not.toBe(b.blocksHash);
    });
});

describe("comparing two runs", () => {
    const entry = (name: string, over: Partial<ManifestEntry> = {}): ManifestEntry => ({
        name,
        kind: "yjs",
        ok: true,
        blocksHash: "b",
        roundTripHash: "r",
        markdownHash: "m",
        reparsedHash: "p",
        ...over,
    });

    it("finds nothing when the runs agree", () => {
        const run = [entry("a"), entry("b")];

        const result = diffManifests(
            run,
            run.map((e) => ({ ...e }))
        );

        expect(result.compared).toBe(2);
        expect(Object.values(result.differing).flat()).toEqual([]);
        expect(result.onlyInA).toEqual([]);
        expect(result.onlyInB).toEqual([]);
    });

    it("names the documents that differ, under the component that differs", () => {
        const a = [entry("one"), entry("two"), entry("three"), entry("four")];
        const b = [
            entry("one", { blocksHash: "changed" }),
            entry("two", { markdownHash: "changed" }),
            entry("three", { ok: false }),
            entry("four"),
        ];

        const { differing } = diffManifests(a, b);

        expect(differing.blocksHash).toEqual(["one"]);
        expect(differing.markdownHash).toEqual(["two"]);
        expect(differing.ok).toEqual(["three"]);
        expect(differing.roundTripHash).toEqual([]);
        expect(differing.reparsedHash).toEqual([]);
    });

    it("reports a document that only one run has", () => {
        const result = diffManifests([entry("a"), entry("gone")], [entry("a"), entry("new")]);

        expect(result.onlyInA).toEqual(["gone"]);
        expect(result.onlyInB).toEqual(["new"]);
        expect(result.compared).toBe(1);
    });

    it("builds a manifest entry from hashes and counts, never content", async () => {
        const doc = await checkDocument({
            kind: "blocks",
            name: "secret-note",
            blocks: [{ id: "a", type: "paragraph", content: "private words", children: [] }],
        });

        const text = JSON.stringify(toManifestEntry(doc));

        expect(text).not.toContain("private words");
        expect(text).toContain("secret-note");
    });
});

describe("the command line", () => {
    const run = (...args: string[]) =>
        spawnSync(process.execPath, ["scripts/blocknote-compat.mjs", ...args], {
            cwd: ROOT,
            encoding: "utf8",
        });

    it("reads a dump, writes results and a manifest, and compares two runs", () => {
        const dir = mkdtempSync(join(tmpdir(), "compat-cli-"));
        try {
            const yjs = loadYjs()[0];
            const dump = join(dir, "dump.jsonl");
            writeFileSync(
                dump,
                [
                    JSON.stringify({ kind: "yjs", name: "task-body:1", data: yjs.data }),
                    JSON.stringify({
                        kind: "blocks",
                        name: "task-content:2",
                        blocks: fixtureDocs[0].blocks,
                    }),
                    JSON.stringify({ kind: "blocks", name: "my-note:3", blocks: [] }),
                ].join("\n")
            );

            const first = run("read", dump, join(dir, "a"));
            const second = run("read", dump, join(dir, "b"));
            const same = run("diff", join(dir, "a"), join(dir, "b"));

            expect(first.status, first.stderr).toBe(0);
            expect(first.stdout).toContain("3 documents");
            expect(first.stdout).toContain("yjs: 1 documents, 1 read, 0 failed");
            expect(first.stdout).toContain("blocks: 2 documents, 2 read, 0 failed");
            expect(first.stdout).not.toContain("Release notes");
            expect(second.status).toBe(0);
            expect(same.status, same.stdout).toBe(0);
            expect(same.stdout).toContain("No differences");

            const manifest = JSON.parse(readFileSync(join(dir, "a", "manifest.json"), "utf8"));
            expect(manifest.entries.map((e: ManifestEntry) => e.name)).toEqual([
                "my-note:3",
                "task-body:1",
                "task-content:2",
            ]);
            expect(JSON.stringify(manifest)).not.toContain("Release notes");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 120000);

    it("exits non-zero and names the document when two runs differ", () => {
        const dir = mkdtempSync(join(tmpdir(), "compat-cli-"));
        try {
            const dumpOf = (text: string) => {
                const path = join(dir, `${text}.jsonl`);
                writeFileSync(
                    path,
                    JSON.stringify({
                        kind: "blocks",
                        name: "my-note:9",
                        blocks: [{ id: "a", type: "paragraph", content: text, children: [] }],
                    })
                );
                return path;
            };
            run("read", dumpOf("one"), join(dir, "a"));
            run("read", dumpOf("two"), join(dir, "b"));

            const result = run("diff", join(dir, "a"), join(dir, "b"));

            expect(result.status).toBe(1);
            expect(result.stdout).toContain("blocksHash differs in 1: my-note:9");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 120000);

    it("reports a document it cannot read and still reads the rest", () => {
        const dir = mkdtempSync(join(tmpdir(), "compat-cli-"));
        try {
            mkdirSync(dir, { recursive: true });
            const dump = join(dir, "dump.jsonl");
            writeFileSync(
                dump,
                [
                    JSON.stringify({
                        kind: "blocks",
                        name: "task-content:5",
                        blocks: [{ id: "x", type: "no-such-block", props: {}, children: [] }],
                    }),
                    JSON.stringify({ kind: "blocks", name: "task-content:6", blocks: [] }),
                ].join("\n")
            );

            const result = run("read", dump, join(dir, "out"));

            expect(result.status, result.stderr).toBe(0);
            expect(result.stdout).toContain("2 documents, 1 read, 1 failed");
            expect(result.stdout).toContain("task-content:5");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 120000);

    it("refuses a malformed dump line instead of skipping it", () => {
        const dir = mkdtempSync(join(tmpdir(), "compat-cli-"));
        try {
            const dump = join(dir, "dump.jsonl");
            writeFileSync(dump, "this is not json\n");

            const result = run("read", dump, join(dir, "out"));

            expect(result.status).toBe(2);
            expect(result.stderr).toContain("line 1");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 120000);
});
