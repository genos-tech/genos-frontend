import fs from "node:fs";
import path from "node:path";

export const SRC_ROOT = path.resolve(__dirname, "..");

const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "__tests__" || entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walk(full));
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
};

/**
 * The only production files allowed to call `BlockNoteSchema.create(` (MIP-1131). Every editor
 * gets its schema from the `genos/genosSchema.ts` factory; adding a type means editing the
 * factory (or `genosSchemaParts.ts`), never a wrapper.
 *  - the factory: every editor surface (13 wrappers + the v3 composer);
 *  - the headless schema: markdown / Yjs conversion in plain Node, same parts, stub renders;
 *  - the comment schema: BlockNote's own comment composer, paragraph-only by design.
 * `devtools/` is the compat tool's own copy and is not production code.
 */
export const SCHEMA_FACTORY = "components/editors/genos/genosSchema.ts";
export const HEADLESS_SCHEMA = "components/editors/headlessNoteSchema.ts";
export const COMMENT_SCHEMA = "components/editors/sub/CommentEditorWithMentions.tsx";
export const ALLOWED_SCHEMA_SITES = [SCHEMA_FACTORY, HEADLESS_SCHEMA, COMMENT_SCHEMA].sort();

export const schemaSites = (): string[] =>
    walk(SRC_ROOT)
        .filter((file) => fs.readFileSync(file, "utf8").includes("BlockNoteSchema.create("))
        .map((file) => path.relative(SRC_ROOT, file))
        .filter((rel) => !rel.startsWith("devtools/"))
        .sort();

export const readSrc = (rel: string): string => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
