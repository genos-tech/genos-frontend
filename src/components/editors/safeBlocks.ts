// A body the editor can always take (MIP-1601).
//
// A note or task body reaches the editors from outside them: a REST copy, a body an agent or
// MCP client wrote, an imported .md, a restored version. BlockNote converts such a body to
// ProseMirror nodes in ONE step, and a single block it cannot convert (an unknown block or
// inline type, a style it has no spec for, a table with no rows, a mention inside a code
// block, a text run with no `text`) makes that step throw, so the whole body is rejected:
// `replaceBlocks`, `blocksToYXmlFragment` and `initialContent` all fail as one. The rule here
// is that a bad block degrades and the rest of the body survives: a block the schema cannot
// build becomes a plain paragraph with the text it carried (and its children, handled the
// same way), and a block with nothing to keep is skipped. Valid blocks are returned as they
// were, by reference.
import { blockToNode, type PartialBlock } from "@blocknote/core";
import type { Schema } from "prosemirror-model";

import { normalizeCodeBlockLanguages } from "./codeBlockLanguage";

type AnyRecord = Record<string, unknown>;

/** The two things of an editor (real or headless) that decide which blocks it can build. */
export interface BlockSchemaHolder {
    pmSchema: Schema;
    schema: { styleSchema: unknown };
}

const inlineText = (item: unknown): string => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    const node = item as AnyRecord;
    if (typeof node.text === "string") return node.text;
    // A link keeps its label; any other inline node has no text of its own to keep.
    if (Array.isArray(node.content)) return node.content.map(inlineText).join("");
    return "";
};

/** The text a block carries, whatever its shape: inline runs, links, table cells. */
export const blockPlainText = (block: unknown): string => {
    if (typeof block === "string") return block;
    if (!block || typeof block !== "object") return "";
    const content = (block as AnyRecord).content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.map(inlineText).join("");
    if (content && typeof content === "object" && Array.isArray((content as AnyRecord).rows)) {
        return ((content as AnyRecord).rows as AnyRecord[])
            .map((row) =>
                (Array.isArray(row?.cells) ? (row.cells as unknown[]) : [])
                    .map((cell) =>
                        Array.isArray(cell) ? cell.map(inlineText).join("") : blockPlainText(cell)
                    )
                    .join(" ")
            )
            .join("\n");
    }
    return "";
};

export interface SanitizeReport {
    /** Blocks that were rebuilt as plain paragraphs. */
    degraded: number;
    /** Blocks that had nothing to keep and were dropped. */
    skipped: number;
    /** The first error BlockNote raised, for the log line. */
    firstError?: unknown;
}

/**
 * `blocks` with every block the editor's schema cannot build rewritten as plain text (or
 * dropped when empty), and every code block's language resolved to one the editor has.
 * Never throws; returns the input array itself when nothing needed changing.
 */
export const sanitizeBlocksForEditor = (
    blocks: unknown[],
    editor: BlockSchemaHolder,
    report: SanitizeReport = { degraded: 0, skipped: 0 }
): PartialBlock[] => {
    const input = normalizeCodeBlockLanguages(blocks);
    // Without a schema nothing can be checked, and nothing may be dropped for that.
    if (!editor?.pmSchema || !editor.schema) return input as PartialBlock[];
    const buildable = (block: unknown): boolean => {
        try {
            blockToNode(
                block as PartialBlock,
                editor.pmSchema,
                editor.schema.styleSchema as never
            ).check();
            return true;
        } catch (error) {
            report.firstError ??= error;
            return false;
        }
    };

    const walk = (list: unknown[]): unknown[] => {
        let changed = false;
        const out: unknown[] = [];
        for (const block of list) {
            if (buildable(block)) {
                out.push(block);
                continue;
            }
            changed = true;
            const children =
                block && typeof block === "object" && Array.isArray((block as AnyRecord).children)
                    ? walk((block as AnyRecord).children as unknown[])
                    : [];
            // The block itself may be fine and only a child bad: keep it with the repaired children.
            if (block && typeof block === "object" && children.length > 0) {
                const repaired = { ...(block as AnyRecord), children };
                if (buildable(repaired)) {
                    out.push(repaired);
                    continue;
                }
            }
            const text = blockPlainText(block);
            const paragraph = {
                type: "paragraph",
                ...(text ? { content: text } : {}),
                ...(children.length > 0 ? { children } : {}),
            };
            if (!text && children.length === 0) {
                report.skipped++;
            } else if (buildable(paragraph)) {
                report.degraded++;
                out.push(paragraph);
            } else {
                report.skipped++;
            }
        }
        return changed ? out : list;
    };
    return walk(input) as PartialBlock[];
};

/** Log once per body what `sanitizeBlocksForEditor` had to change (nothing, when it changed nothing). */
export const logSanitizeReport = (where: string, report: SanitizeReport): void => {
    if (report.degraded === 0 && report.skipped === 0) return;
    console.warn(
        `[editor] ${where}: ${report.degraded} block(s) the editor cannot build were shown as plain text, ` +
            `${report.skipped} empty one(s) were skipped; the rest of the body was kept.`,
        report.firstError
    );
};
