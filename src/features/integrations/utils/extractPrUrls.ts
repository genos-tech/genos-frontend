import { parsePrUrl } from "./parsePrUrl";

// Walks a BlockNote document and returns the unique GitHub PR URLs it
// references. Two paths covered:
//   1. BlockNote link inline content (`{ type: "link", href, content }`)
//      — what you get after BlockNote auto-linkifies a pasted URL.
//   2. Plain text that contains a raw PR URL — the brief window before
//      auto-linkification, or text the user typed letter-by-letter.
//
// Used by TaskMainBlock to mirror PR URLs from the task body into the
// `links` list so the LinkedPrCard appears in the metadata panel
// without the user having to add the URL twice.

const PR_URL_GLOBAL_RE = /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/g;

export const extractPrUrlsFromBlocks = (blocks: unknown): string[] => {
    if (!Array.isArray(blocks)) return [];
    const found = new Set<string>();

    const visit = (nodes: any[]) => {
        for (const node of nodes) {
            if (!node) continue;
            if (Array.isArray(node.content)) {
                for (const item of node.content) {
                    if (!item) continue;
                    if (item.type === "link" && typeof item.href === "string") {
                        if (parsePrUrl(item.href)) found.add(item.href);
                    }
                    if (item.type === "text" && typeof item.text === "string") {
                        const matches = item.text.match(PR_URL_GLOBAL_RE);
                        if (matches) {
                            for (const m of matches) {
                                if (parsePrUrl(m)) found.add(m);
                            }
                        }
                    }
                }
            }
            if (Array.isArray(node.children)) visit(node.children);
        }
    };
    visit(blocks);
    return Array.from(found);
};
