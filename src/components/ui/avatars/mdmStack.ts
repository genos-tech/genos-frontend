// The geometry of the multi-person DM's stack of member faces (`MDMAvatar`), in a plain module so
// a host that has to reserve room for the stack (a report row) can size its slot from the same
// numbers without loading the component.

/** How many members the stack shows: the rest are not drawn. */
export const MDM_MAX_VISIBLE = 3;

/** How far each face sits from the one before it, as a share of the face's size. */
export const MDM_STEP = 0.55;

/** The width of a stack of `memberCount` faces of `faceSize` px. An empty stack is the single
 *  people glyph, one face wide. */
export const mdmStackWidth = (memberCount: number, faceSize: number): number => {
    const shown = Math.min(Math.max(memberCount, 1), MDM_MAX_VISIBLE);
    return faceSize + (shown - 1) * faceSize * MDM_STEP;
};
