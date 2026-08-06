/**
 * Relative media links in an imported note body.
 *
 * A Notion export writes its images as paths next to the markdown file
 * ("Roadmap%20abc/Screenshot.png"), which mean nothing once the note is
 * on a server. The importer has to find those links, upload the picked
 * file each one points at, and put the resulting URL back — otherwise
 * every image in a migrated page is a dead reference.
 *
 * Deliberately operating on the PARSED blocks rather than the markdown
 * text: `markdownToNoteBlocks` has already decided what is a media block
 * and what is an ordinary link, so there is no second markdown regex here
 * to disagree with the first one and no escaping to get wrong.
 */

/** Block types whose `props.url` points at a file. `video`/`audio` are
 *  stripped from the note schema today but cost nothing to cover, and
 *  BlockNote's parser can still produce them from raw HTML. */
const MEDIA_BLOCK_TYPES = new Set(["image", "file", "video", "audio"]);

type AnyRecord = Record<string, unknown>;

/**
 * A link that could name a file inside the picked folder.
 *
 * Anything with a scheme already points somewhere real (`https:`,
 * `data:`, `mailto:`), and a root-relative path is addressing the server,
 * not the export — neither can be resolved against the picked files, so
 * both are left exactly as they are.
 */
export const isRelativeAssetHref = (url: unknown): url is string =>
    typeof url === "string" &&
    url !== "" &&
    !/^[a-z][a-z0-9+.-]*:/i.test(url) &&
    !url.startsWith("/") &&
    !url.startsWith("#");

/**
 * Resolve `href` against the directory its markdown file lived in.
 *
 * Notion percent-encodes these ("Roadmap%20abc/img.png") while the
 * `File` list carries real names, so decoding is what makes the two
 * comparable. A malformed escape decodes to itself rather than throwing —
 * a broken link should cost its own image, not the whole import.
 */
export const resolveAssetPath = (sourceDir: string, href: string): string => {
    let decoded = href;
    try {
        decoded = decodeURIComponent(href);
    } catch {
        // Leave it as written; the lookup will simply miss.
    }
    // Strip any query/fragment — they address a rendition, not a file.
    decoded = decoded.split(/[?#]/)[0];

    const segments = [...sourceDir.split("/"), ...decoded.split("/")].filter(Boolean);
    const out: string[] = [];
    for (const segment of segments) {
        if (segment === ".") continue;
        if (segment === "..") out.pop();
        else out.push(segment);
    }
    return out.join("/");
};

const eachMediaBlock = (blocks: unknown[], visit: (block: AnyRecord) => void): void => {
    for (const raw of blocks) {
        if (!raw || typeof raw !== "object") continue;
        const block = raw as AnyRecord;
        if (typeof block.type === "string" && MEDIA_BLOCK_TYPES.has(block.type)) visit(block);
        if (Array.isArray(block.children)) eachMediaBlock(block.children, visit);
    }
};

/** Every relative media href in `blocks`, deduped, in document order. */
export const collectRelativeAssetHrefs = (blocks: unknown[]): string[] => {
    const found = new Set<string>();
    eachMediaBlock(blocks, (block) => {
        const url = (block.props as AnyRecord | undefined)?.url;
        if (isRelativeAssetHref(url)) found.add(url);
    });
    return [...found];
};

/**
 * Replace the relative hrefs listed in `uploaded` with their new URLs.
 *
 * Returns a new tree; blocks whose href has no entry (nothing in the
 * picked folder matched, or the upload failed) are returned untouched, so
 * a partial result still carries every image that did make it.
 */
export const rewriteAssetHrefs = (blocks: unknown[], uploaded: Map<string, string>): unknown[] => {
    if (uploaded.size === 0) return blocks;
    return blocks.map((raw) => {
        if (!raw || typeof raw !== "object") return raw;
        const block = raw as AnyRecord;
        const next: AnyRecord = { ...block };
        if (Array.isArray(block.children)) {
            next.children = rewriteAssetHrefs(block.children, uploaded);
        }
        if (typeof block.type === "string" && MEDIA_BLOCK_TYPES.has(block.type)) {
            const props = (block.props ?? {}) as AnyRecord;
            const replacement = isRelativeAssetHref(props.url)
                ? uploaded.get(props.url)
                : undefined;
            if (replacement) next.props = { ...props, url: replacement };
        }
        return next;
    });
};
