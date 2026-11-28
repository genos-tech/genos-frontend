// The geometry of the multi-person DM's stack of member faces (`MDMAvatar`), in a plain module so
// a host that has to reserve room for the stack (a report row) can size its slot from the same
// numbers without loading the component.

/** How many circles the stack draws at most, the "+N" one included. */
export const MDM_MAX_VISIBLE = 3;

/** What a stack of `total` members draws: every face while they fit, otherwise one face fewer
 *  and a "+N" circle for the rest, so `faces + overflow` is always the member total
 *  (MIP-2549). Either way it is at most `MDM_MAX_VISIBLE` circles wide. */
export const mdmFaces = (total: number): { faces: number; overflow: number } => {
    if (total <= MDM_MAX_VISIBLE) return { faces: Math.max(total, 0), overflow: 0 };
    const faces = MDM_MAX_VISIBLE - 1;
    return { faces, overflow: total - faces };
};

/** How far each face sits from the one before it, as a share of the face's size. */
export const MDM_STEP = 0.55;

/** The width of a stack of `memberCount` faces of `faceSize` px. An empty stack is the single
 *  people glyph, one face wide. */
export const mdmStackWidth = (memberCount: number, faceSize: number): number => {
    const shown = Math.min(Math.max(memberCount, 1), MDM_MAX_VISIBLE);
    return faceSize + (shown - 1) * faceSize * MDM_STEP;
};

/** Where a no-picture face's initial sits, as a move from the face's centre in px. */
export type MDMInitialOffset = {
    /** Towards the visible side of the face (the end side: right in LTR, left in RTL). */
    inline: number;
    /** Down is positive. */
    block: number;
};

/**
 * Where a no-picture face's initial goes so the next face does not cover it.
 *
 * Every face but the first has the face before it drawn over its start-side `1 - MDM_STEP` (45%),
 * so a letter centred on the whole face is half under that neighbour (a "B" reads as a "3").
 * The visible part runs from `1 - MDM_STEP` to the face's far edge, so its centre is half of that
 * share of a face away from the face's own centre. The first face is drawn whole: no move.
 *
 * The presence dot (chat list) sits in the lower end corner of the same visible part, so with a
 * dot the letter moves less towards that corner and a little up, to stay clear of it.
 */
export const mdmInitialOffset = (
    faceIndex: number,
    faceSize: number,
    hasPresenceDot: boolean
): MDMInitialOffset => {
    // Hundredths of a px: the numbers go straight into CSS.
    const px = (n: number) => Math.round(n * 100) / 100;
    if (faceIndex <= 0) return { inline: 0, block: 0 };
    if (hasPresenceDot) return { inline: px(faceSize * 0.09), block: px(-faceSize * 0.07) };
    return { inline: px((faceSize * (1 - MDM_STEP)) / 2), block: 0 };
};
