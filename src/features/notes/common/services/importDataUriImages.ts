import { collectDataUriImageUrls, replaceDataUriImages } from "./noteAssetLinks";

/**
 * Move `data:` images out of an imported note body.
 *
 * A Google Docs Markdown export writes every picture as a base64 `data:`
 * URI, so a doc with a few photos becomes a note body of many MB: slow
 * to save, to sync and to open. The editors store a pasted image as an
 * uploaded note file and keep only its URL in the body; this does the
 * same for an import, with the same upload the editors use (the caller
 * passes it in, already bound to the note and its ACL).
 *
 * An image that cannot be moved (over the plan's per-file ceiling, not
 * decodable, refused by the server) is NOT kept inline: the API refuses a
 * request body over ~2.5 MB (`RequestDataTooBig`), so one big leftover
 * would fail the whole note. It becomes a one-line paragraph saying which
 * image was left out, and the caller shows a warning per image.
 *
 * The same limit is why the note must be CREATED without the pixels:
 * `withoutDataUriImages` makes that body, `externalizeDataUriImages` the
 * final one.
 */

/** The body to create the note with: every `data:` image is an image
 *  block with an empty url, filled in once its file is uploaded. */
export const withoutDataUriImages = (body: unknown[]): unknown[] =>
    replaceDataUriImages(body, () => ({ url: "" }));

export type DataUriImageWarning = {
    /** 1-based position among the document's data: images. */
    index: number;
    reason: "too-large" | "upload-failed" | "undecodable";
    /** Decoded size; 0 when it could not be decoded. */
    bytes: number;
    mime: string;
};

export type DataUriImageReport = {
    uploaded: number;
    warnings: DataUriImageWarning[];
    /** JSON size of the body before and after. */
    bytesBefore: number;
    bytesAfter: number;
};

const EXTENSIONS: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
    "image/x-icon": "ico",
};

const extensionFor = (mime: string): string =>
    EXTENSIONS[mime] ?? (mime.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "");

type Parsed = { mime: string; base64: boolean; payload: string };

const parseDataUri = (url: string): Parsed | null => {
    const m = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/is.exec(url);
    if (!m) return null;
    const base64 = /;base64/i.test(m[2]);
    return {
        mime: m[1].toLowerCase(),
        base64,
        // Exports wrap long base64 and some write the URL-safe alphabet or
        // a percent-encoded padding: normalise so size and decode agree.
        payload: base64
            ? m[3].replace(/%3D/gi, "=").replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/")
            : m[3],
    };
};

/** Decoded byte length without decoding, so an oversize image is
 *  rejected before it costs a multi-MB allocation. */
const decodedLength = (p: Parsed): number => {
    if (p.base64) {
        const padding = /=*$/.exec(p.payload)?.[0].length ?? 0;
        return Math.floor((p.payload.length * 3) / 4) - padding;
    }
    return textBytes(p.payload).length;
};

/** A non-base64 payload is percent-encoded text; a stray literal `%`
 *  (an svg's `width="100%"`) is taken as itself, as a browser would. */
const textBytes = (payload: string): Uint8Array => {
    try {
        return new TextEncoder().encode(decodeURIComponent(payload));
    } catch {
        return new TextEncoder().encode(payload);
    }
};

const decodeBytes = (p: Parsed): Uint8Array | null => {
    try {
        if (p.base64) {
            const raw = atob(p.payload);
            const out = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
            return out;
        }
        return textBytes(p.payload);
    } catch {
        return null;
    }
};

const defaultPlaceholder = (index: number): string => `[Image ${index} was not imported]`;

/** Every data: image of `body` as a warning of one reason; for a write
 *  that failed after the images had been blanked. */
export const dataImageWarnings = (
    body: unknown[],
    reason: DataUriImageWarning["reason"]
): DataUriImageWarning[] =>
    collectDataUriImageUrls(body).map((url, i) => {
        const parsed = parseDataUri(url);
        return {
            index: i + 1,
            reason,
            bytes: parsed ? decodedLength(parsed) : 0,
            mime: parsed?.mime ?? "",
        };
    });

export const externalizeDataUriImages = async (args: {
    body: unknown[];
    /** Per-file ceiling from the user's plan; null = let the server decide. */
    uploadLimitBytes: number | null;
    /** Uploads one file against the (already created) note, resolves to its URL. */
    upload: (file: File) => Promise<string>;
    /** The line that stands in for an image that was left out; saved into
     *  the note, so the caller passes it in the user's language. */
    placeholderText?: (index: number) => string;
}): Promise<{ body: unknown[]; report: DataUriImageReport }> => {
    const bytesBefore = JSON.stringify(args.body).length;
    const urls = collectDataUriImageUrls(args.body);
    const report: DataUriImageReport = {
        uploaded: 0,
        warnings: [],
        bytesBefore,
        bytesAfter: bytesBefore,
    };
    if (urls.length === 0) return { body: args.body, report };

    const replacements = new Map<string, string>();
    for (const [i, url] of urls.entries()) {
        const index = i + 1;
        const parsed = parseDataUri(url);
        const mime = parsed?.mime ?? "";
        const bytes = parsed ? decodedLength(parsed) : 0;
        if (!parsed || bytes === 0) {
            report.warnings.push({ index, reason: "undecodable", bytes: 0, mime });
            continue;
        }
        if (args.uploadLimitBytes != null && bytes > args.uploadLimitBytes) {
            report.warnings.push({ index, reason: "too-large", bytes, mime });
            continue;
        }
        const data = decodeBytes(parsed);
        if (!data) {
            report.warnings.push({ index, reason: "undecodable", bytes: 0, mime });
            continue;
        }
        try {
            const file = new File([data as BlobPart], `image-${index}.${extensionFor(mime)}`, {
                type: mime,
            });
            replacements.set(url, await args.upload(file));
            report.uploaded += 1;
        } catch {
            report.warnings.push({ index, reason: "upload-failed", bytes, mime });
        }
    }

    const body = replaceDataUriImages(args.body, (url, index) => {
        const uploaded = replacements.get(url);
        return uploaded
            ? { url: uploaded }
            : { text: (args.placeholderText ?? defaultPlaceholder)(index) };
    });
    report.bytesAfter = JSON.stringify(body).length;
    return { body, report };
};
