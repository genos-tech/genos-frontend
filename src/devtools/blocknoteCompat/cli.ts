/**
 * Command line for the BlockNote compatibility check (MIP-1008). Run it through
 * `npm run blocknote-compat -- <command>`, which bundles this file and runs it
 * under Node against whatever BlockNote is installed.
 *
 *   read <dump.jsonl> <outDir>   read every document in a dump with the installed
 *                                BlockNote and write the results
 *   diff <outDirA> <outDirB>     compare two runs over the same dump
 *   fixture <outDir>             run the committed synthetic fixture
 *
 * A dump is one JSON object per line:
 *   {"kind":"yjs","name":"task-body:7","data":"<base64 of the stored update>"}
 *   {"kind":"blocks","name":"task-content:7","blocks":[...]}
 *
 * What it prints is counts and document names: never text. What it writes to
 * `<outDir>` is the full result of each document, which for a real dump is
 * private workspace content: keep that directory out of the repo and out of
 * comments. `manifest.json` holds only hashes and counts and is what `diff`
 * reads.
 */

import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { JSDOM } from "jsdom";

// BlockNote's markdown and HTML conversion need a DOM; Node has none. Set one up
// before anything from BlockNote is loaded.
const installDom = () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "http://localhost/",
        pretendToBeVisual: true,
    });
    const names = [
        "window",
        "document",
        "navigator",
        "DOMParser",
        "Node",
        "Element",
        "HTMLElement",
        "HTMLAnchorElement",
        "MutationObserver",
        "getComputedStyle",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "Range",
        "Selection",
        "CustomEvent",
        "Event",
        "KeyboardEvent",
        "MouseEvent",
        "DocumentFragment",
        "XMLSerializer",
    ];
    const win = dom.window as unknown as Record<string, unknown>;
    for (const name of names) {
        const value = name === "window" ? dom.window : win[name];
        if (value === undefined) continue;
        Object.defineProperty(globalThis, name, {
            value,
            configurable: true,
            writable: true,
        });
    }
};

const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]/g, "_");

const installedVersions = () => {
    const read = (pkg: string) => {
        try {
            return JSON.parse(
                readFileSync(join(process.cwd(), "node_modules", pkg, "package.json"), "utf8")
            ).version as string;
        } catch {
            return "?";
        }
    };
    return {
        "@blocknote/core": read("@blocknote/core"),
        "y-prosemirror": read("y-prosemirror"),
        yjs: read("yjs"),
    };
};

const printable = (names: string[], limit = 60) =>
    names.length <= limit
        ? names.join(", ")
        : `${names.slice(0, limit).join(", ")}, ... and ${names.length - limit} more`;

const readDump = async function* (path: string) {
    const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
    let lineNo = 0;
    for await (const line of lines) {
        lineNo += 1;
        if (!line.trim()) continue;
        let row: { kind?: string; name?: string; data?: string; blocks?: unknown };
        try {
            row = JSON.parse(line);
        } catch {
            throw new Error(`dump line ${lineNo} is not JSON`);
        }
        if (typeof row.name !== "string") throw new Error(`dump line ${lineNo} has no name`);
        if (row.kind === "yjs" && typeof row.data === "string") {
            yield {
                kind: "yjs" as const,
                name: row.name,
                update: Buffer.from(row.data, "base64"),
            };
        } else if (row.kind === "blocks") {
            yield { kind: "blocks" as const, name: row.name, blocks: row.blocks };
        } else {
            throw new Error(`dump line ${lineNo} (${row.name}) has an unknown kind`);
        }
    }
};

const summarise = (
    entries: import("./compat").ManifestEntry[],
    log: (line: string) => void = console.log
) => {
    const kinds = [...new Set(entries.map((e) => e.kind))].sort();
    for (const kind of kinds) {
        const of = entries.filter((e) => e.kind === kind);
        const ok = of.filter((e) => e.ok);
        const failed = of.filter((e) => !e.ok);
        log(`${kind}: ${of.length} documents, ${ok.length} read, ${failed.length} failed`);
        const errors = new Map<string, string[]>();
        for (const e of failed) {
            const key = (e.error ?? "?").replace(/\d+/g, "N");
            errors.set(key, [...(errors.get(key) ?? []), e.name]);
        }
        for (const [error, names] of errors) {
            log(`  failed (${names.length}) ${error}: ${printable(names, 20)}`);
        }
        const unequal = ok.filter((e) => e.roundTripEqual === false).map((e) => e.name);
        log(
            `  round trip through Yjs unchanged: ${ok.length - unequal.length} of ${ok.length}` +
                (unequal.length ? ` (changed: ${printable(unequal, 20)})` : "")
        );
        const generated = ok.filter((e) => e.idsGenerated).map((e) => e.name);
        if (generated.length) {
            log(`  stored without block ids (compared without ids): ${generated.length}`);
        }
        const types: Record<string, number> = {};
        for (const e of ok) {
            for (const [type, n] of Object.entries(e.types ?? {}))
                types[type] = (types[type] ?? 0) + n;
        }
        const total = Object.entries(types)
            .sort((a, b) => b[1] - a[1])
            .map(([type, n]) => `${type} ${n}`)
            .join(", ");
        log(`  blocks by type: ${total || "none"}`);
    }
};

const runRead = async (
    inputs: AsyncIterable<import("./compat").CompatInput>,
    outDir: string,
    source: string
) => {
    const { checkDocument, toManifestEntry } = await import("./compat");
    mkdirSync(outDir, { recursive: true });
    const entries: import("./compat").ManifestEntry[] = [];
    const used = new Set<string>();
    for await (const input of inputs) {
        const doc = await checkDocument(input);
        entries.push(toManifestEntry(doc));
        mkdirSync(join(outDir, "docs", doc.kind), { recursive: true });
        let file = safeName(doc.name);
        while (used.has(`${doc.kind}/${file}`)) file += "_";
        used.add(`${doc.kind}/${file}`);
        writeFileSync(
            join(outDir, "docs", doc.kind, `${file}.json`),
            JSON.stringify(doc, null, 2)
        );
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const manifest = {
        versions: installedVersions(),
        source: basename(source),
        createdAt: new Date().toISOString(),
        entries,
    };
    writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`BlockNote ${manifest.versions["@blocknote/core"]}: ${entries.length} documents`);
    summarise(entries);
};

const runDiff = async (dirA: string, dirB: string) => {
    const { diffManifests } = await import("./compat");
    const load = (dir: string) =>
        JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as {
            versions: Record<string, string>;
            entries: import("./compat").ManifestEntry[];
        };
    const a = load(dirA);
    const b = load(dirB);
    const result = diffManifests(a.entries, b.entries);
    console.log(
        `A: BlockNote ${a.versions["@blocknote/core"]}, ${a.entries.length} documents. ` +
            `B: BlockNote ${b.versions["@blocknote/core"]}, ${b.entries.length} documents. ` +
            `Compared ${result.compared}.`
    );
    if (result.onlyInA.length)
        console.log(`only in A (${result.onlyInA.length}): ${printable(result.onlyInA)}`);
    if (result.onlyInB.length)
        console.log(`only in B (${result.onlyInB.length}): ${printable(result.onlyInB)}`);
    let any = false;
    for (const [component, names] of Object.entries(result.differing)) {
        if (names.length === 0) continue;
        any = true;
        console.log(`${component} differs in ${names.length}: ${printable(names)}`);
    }
    if (!any && !result.onlyInA.length && !result.onlyInB.length) {
        console.log("No differences: every document reads the same.");
    }
    process.exitCode = any || result.onlyInA.length || result.onlyInB.length ? 1 : 0;
};

const fixtureInputs = async function* () {
    const fixture = JSON.parse(
        readFileSync(
            join(process.cwd(), "src/__tests__/fixtures/blocknoteCompat/synthetic.json"),
            "utf8"
        )
    ) as { docs: { name: string; blocks: unknown }[] };
    for (const doc of fixture.docs) {
        yield { kind: "blocks" as const, name: doc.name, blocks: doc.blocks };
    }
};

const main = async () => {
    const [command, ...args] = process.argv.slice(2);
    installDom();
    if (command === "read" && args.length === 2) {
        await runRead(readDump(args[0]), args[1], args[0]);
    } else if (command === "diff" && args.length === 2) {
        await runDiff(args[0], args[1]);
    } else if (command === "fixture" && args.length === 1) {
        await runRead(fixtureInputs(), args[0], "synthetic.json");
    } else {
        console.error(
            "usage: blocknote-compat read <dump.jsonl> <outDir> | diff <outDirA> <outDirB> | fixture <outDir>"
        );
        process.exitCode = 2;
    }
};

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
});
