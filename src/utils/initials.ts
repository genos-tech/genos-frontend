// The letter an avatar shows when it has no picture.
//
// It is the first LETTER (or digit) of the name, not the first character:
// "(DY) Ken Kamiya" shows "D", not "(", and "  @ken" shows "K". It works on
// code points, not UTF-16 units, so a CJK name, an astral-plane letter or an
// accented capital is never split into a lone surrogate, and "ß" and "ǆ" are
// upper-cased as one letter would be. A name with no letter at all (an emoji,
// punctuation only) falls back to its first visible character, then to "?".

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export const initialOf = (name: string | null | undefined, fallback = "?"): string => {
    const chars = Array.from((name ?? "").trim());
    const letter = chars.find((c) => LETTER_OR_DIGIT.test(c));
    const first = letter ?? chars[0];
    if (!first) return fallback;
    // Only the first code point of an upper-cased expansion ("ß" -> "SS").
    return Array.from(first.toLocaleUpperCase())[0] ?? fallback;
};
