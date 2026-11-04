import { createHash } from "node:crypto";
import { BlockNoteEditor } from "@blocknote/core";
import { blocksToYXmlFragment, yXmlFragmentToBlocks } from "@blocknote/core/yjs";
import * as Y from "yjs";

import {
    createHeadlessNoteEditor,
    createHeadlessNoteSchema,
} from "../../components/editors/headlessNoteSchema";
import {
    markdownToNoteBlocks,
    noteBlocksToMarkdown,
} from "../../features/notes/common/services/noteMarkdown";

/**
 * Does a stored document still read the same after a BlockNote upgrade?
 * (MIP-1008, for MIP-985)
 *
 * A note or task body is stored two ways: as a Yjs document that genos-collab
 * persists (`yjs_documents`, fragment `document-store`), and as block JSON in a
 * Django field (`TaskMaster.content`, the three note `body` fields). This reads
 * a document the way the editors do, with the schema they register, and reduces
 * what the installed BlockNote makes of it to plain, comparable data. Run it
 * once on 0.49 and once on 0.57 over the same stored documents, then diff.
 *
 * Four things are recorded per document, because each is a different way for an
 * upgrade to change what people see:
 *  - `blocks`: what the editor reads. For a Yjs document, `yXmlFragmentToBlocks`
 *    on the stored update; for block JSON, an editor built with it as
 *    `initialContent`.
 *  - `roundTrip`: those blocks written into a fresh Yjs fragment and read back,
 *    which is what genos-collab's `bodyReplace` and `applyNoteBodyToYjs` do.
 *  - `markdown`: the note export (`noteBlocksToMarkdown`). BlockNote 0.51
 *    replaced its markdown parser and serializer.
 *  - `reparsed`: that markdown parsed back to blocks (ids dropped: they are
 *    generated fresh), which is what a markdown import does.
 *
 * Nothing here is read from or written to production: it takes bytes and JSON
 * in, and returns data. Stored documents are private workspace content, so the
 * outputs of a real run stay out of the repo and out of task comments; only the
 * counts and the names of documents that differ (`task-body:7`) are shared.
 */

export type CompatInput =
    | { kind: "yjs"; name: string; update: Uint8Array }
    | { kind: "blocks"; name: string; blocks: unknown };

export interface RoundTrip {
    equal: boolean;
    hash: string;
}

export interface CompatDoc {
    name: string;
    kind: CompatInput["kind"];
    ok: boolean;
    /** Set when the document could not be read: the failing step and the message. */
    error?: string;
    /** Block JSON that carried no ids: BlockNote makes them up, differently every
     *  run, so this document is compared without ids. */
    idsGenerated?: boolean;
    blocks?: unknown;
    blocksHash?: string;
    blockCount?: number;
    /** How many blocks of each type, nested ones included. */
    types?: Record<string, number>;
    roundTrip?: RoundTrip;
    markdown?: string;
    markdownHash?: string;
    reparsedHash?: string;
}

/** The fragment every collaborative editor binds (`useCollaborativeBlockNote`). */
export const FRAGMENT_NAME = "document-store";

/** Plain data with its keys in a fixed order, so equal values print equally. */
export const canonical = (value: unknown): string =>
    JSON.stringify(value, (_key, val) => {
        if (val && typeof val === "object" && !Array.isArray(val)) {
            return Object.fromEntries(
                Object.keys(val)
                    .sort()
                    .map((k) => [k, (val as Record<string, unknown>)[k]])
            );
        }
        return val;
    });

export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

const hashOf = (value: unknown): string => sha256(canonical(value));

/** Blocks without their ids, for output that is generated fresh each time. */
const withoutIds = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(withoutIds);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([key]) => key !== "id")
                .map(([key, val]) => [key, withoutIds(val)])
        );
    }
    return value;
};

/** Whether every block, nested ones included, carries an id of its own. */
const hasIds = (blocks: unknown): boolean =>
    Array.isArray(blocks) &&
    (blocks as { id?: unknown; children?: unknown }[]).every(
        (b) =>
            typeof b?.id === "string" &&
            b.id !== "" &&
            (b.children === undefined || b.children === null || hasIds(b.children))
    );

const countTypes = (blocks: unknown, into: Record<string, number> = {}) => {
    if (!Array.isArray(blocks)) return into;
    for (const block of blocks as { type?: string; children?: unknown }[]) {
        const type = typeof block?.type === "string" ? block.type : "?";
        into[type] = (into[type] ?? 0) + 1;
        countTypes(block?.children, into);
    }
    return into;
};

let editor: ReturnType<typeof createHeadlessNoteEditor> | null = null;
let schema: ReturnType<typeof createHeadlessNoteSchema> | null = null;
const holder = () => (editor ??= createHeadlessNoteEditor());
const noteSchema = () => (schema ??= createHeadlessNoteSchema());

/** The blocks a stored Yjs update holds, read as the editors read it. */
export const readYjsUpdate = (update: Uint8Array): unknown[] => {
    const doc = new Y.Doc();
    try {
        Y.applyUpdate(doc, update);
        return yXmlFragmentToBlocks(holder(), doc.getXmlFragment(FRAGMENT_NAME)) as unknown[];
    } finally {
        doc.destroy();
    }
};

/** The blocks an editor makes of block JSON handed to it as `initialContent`. */
export const readBlockJson = (blocks: unknown): unknown[] => {
    const content = Array.isArray(blocks) && blocks.length > 0 ? blocks : undefined;
    const reader = BlockNoteEditor.create({
        schema: noteSchema(),
        initialContent: content as never,
    });
    return reader.document as unknown[];
};

/** Blocks written into a fresh Yjs fragment and read back (`bodyReplace`). */
export const roundTripThroughYjs = (blocks: unknown[]): unknown[] => {
    const doc = new Y.Doc();
    try {
        const fragment = doc.getXmlFragment(FRAGMENT_NAME);
        blocksToYXmlFragment(
            holder(),
            (blocks.length > 0 ? blocks : [{ type: "paragraph" }]) as never,
            fragment
        );
        return yXmlFragmentToBlocks(holder(), fragment) as unknown[];
    } finally {
        doc.destroy();
    }
};

const step = async <T>(name: string, run: () => T | Promise<T>): Promise<T> => {
    try {
        return await run();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${name}: ${message.split("\n")[0].slice(0, 160)}`);
    }
};

/** Read one stored document. Never throws: a failure is recorded on the result. */
export const checkDocument = async (input: CompatInput): Promise<CompatDoc> => {
    const { name, kind } = input;
    try {
        const read = await step("read", () =>
            input.kind === "yjs" ? readYjsUpdate(input.update) : readBlockJson(input.blocks)
        );
        // Ids BlockNote made up are different every run; leave them out of what is
        // compared. A Yjs document always has its own. An empty body counts: the
        // editor gives it a paragraph with a made-up id.
        const idsGenerated =
            input.kind === "blocks" &&
            !(Array.isArray(input.blocks) && input.blocks.length > 0 && hasIds(input.blocks));
        const norm = (value: unknown) => (idsGenerated ? withoutIds(value) : value);
        // Plain JSON, as it is saved: an `undefined` BlockNote leaves in an array (an
        // unset column width) is `null` there, and a result should read the same
        // in memory as on disk.
        const blocks = JSON.parse(JSON.stringify(norm(read)));
        const doc: CompatDoc = {
            name,
            kind,
            ok: true,
            ...(idsGenerated ? { idsGenerated } : {}),
            blocks,
            blocksHash: hashOf(blocks),
            blockCount: Array.isArray(blocks) ? blocks.length : 0,
            types: countTypes(blocks),
        };

        const again = norm(await step("roundTrip", () => roundTripThroughYjs(read as unknown[])));
        doc.roundTrip = { equal: canonical(again) === canonical(blocks), hash: hashOf(again) };

        const markdown = await step("markdown", () => noteBlocksToMarkdown(blocks));
        doc.markdown = markdown;
        doc.markdownHash = sha256(markdown);
        const reparsed = await step("reparse", () => markdownToNoteBlocks(markdown));
        doc.reparsedHash = hashOf(withoutIds(reparsed));
        return doc;
    } catch (error) {
        return { name, kind, ok: false, error: (error as Error).message };
    }
};

/** What a comparison needs from a result: hashes and counts, never content. */
export interface ManifestEntry {
    name: string;
    kind: CompatInput["kind"];
    ok: boolean;
    error?: string;
    idsGenerated?: boolean;
    blocksHash?: string;
    blockCount?: number;
    types?: Record<string, number>;
    roundTripEqual?: boolean;
    roundTripHash?: string;
    markdownHash?: string;
    reparsedHash?: string;
}

export const toManifestEntry = (doc: CompatDoc): ManifestEntry => ({
    name: doc.name,
    kind: doc.kind,
    ok: doc.ok,
    error: doc.error,
    idsGenerated: doc.idsGenerated,
    blocksHash: doc.blocksHash,
    blockCount: doc.blockCount,
    types: doc.types,
    roundTripEqual: doc.roundTrip?.equal,
    roundTripHash: doc.roundTrip?.hash,
    markdownHash: doc.markdownHash,
    reparsedHash: doc.reparsedHash,
});

export const COMPONENTS = [
    "ok",
    "blocksHash",
    "roundTripHash",
    "markdownHash",
    "reparsedHash",
] as const;
export type Component = (typeof COMPONENTS)[number];

export interface Difference {
    /** Documents that exist in both runs, and differ in this component. */
    differing: Record<Component, string[]>;
    onlyInA: string[];
    onlyInB: string[];
    compared: number;
}

/** Compare two runs over the same stored documents, by name. Names only. */
export const diffManifests = (a: ManifestEntry[], b: ManifestEntry[]): Difference => {
    const byName = (entries: ManifestEntry[]) => new Map(entries.map((e) => [e.name, e]));
    const left = byName(a);
    const right = byName(b);
    const differing = Object.fromEntries(COMPONENTS.map((c) => [c, [] as string[]])) as Record<
        Component,
        string[]
    >;
    let compared = 0;
    for (const [name, x] of left) {
        const y = right.get(name);
        if (!y) continue;
        compared += 1;
        for (const component of COMPONENTS) {
            if (x[component] !== y[component]) differing[component].push(name);
        }
    }
    return {
        differing,
        compared,
        onlyInA: [...left.keys()].filter((n) => !right.has(n)),
        onlyInB: [...right.keys()].filter((n) => !left.has(n)),
    };
};
