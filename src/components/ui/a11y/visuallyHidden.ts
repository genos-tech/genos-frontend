/** Screen-reader-only content: out of the layout and the eye, still in the accessibility tree. */
export const visuallyHidden = {
    position: "absolute",
    width: 1,
    height: 1,
    margin: -1,
    padding: 0,
    border: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
} as const;
