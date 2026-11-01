/**
 * Decode the bytes of a text file the user attached.
 *
 * `Response.text()` always assumes UTF-8, so a Shift-JIS `.txt` (still
 * common among Japanese users) turns into replacement characters. Try a
 * STRICT UTF-8 decode first, which throws on any invalid sequence instead
 * of silently substituting U+FFFD, and fall back to Shift-JIS only then.
 *
 * Valid UTF-8 is never misread: random Shift-JIS text is almost never
 * valid UTF-8, and anything that is valid UTF-8 is decoded as such. A BOM
 * is stripped by the decoder.
 */
export const decodeTextBytes = (bytes: ArrayBuffer | Uint8Array): string => {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        // Invalid UTF-8: fall through to the legacy Japanese encoding.
    }
    try {
        return new TextDecoder("shift_jis").decode(bytes);
    } catch {
        // A runtime without the legacy label (RangeError): lossy UTF-8 is
        // better than refusing the file.
        return new TextDecoder("utf-8").decode(bytes);
    }
};
