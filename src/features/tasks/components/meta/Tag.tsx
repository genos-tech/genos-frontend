import { CSSProperties } from "react";

type TagProps = {
    label: string;
    /** The tag's own color, chosen by a person in the tag picker. It is the
     *  DOT, not the border and text: a table of tags stays calm, and the one
     *  hue that is data is still there. */
    color: string;
    fontSize?: string | number;
};

const chip: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    boxSizing: "border-box",
    maxWidth: "100%",
    height: 20,
    padding: "0 6px",
    overflow: "hidden",
    whiteSpace: "nowrap",
    borderRadius: "var(--g-radius-xs, 4px)",
    border: "1px solid var(--g-border, rgba(128,128,128,0.2))",
    background: "var(--g-surface, transparent)",
    color: "var(--g-text-secondary, inherit)",
    fontWeight: 500,
    lineHeight: 1,
};

/**
 * A tag: a neutral chip with the tag's color as a small dot (MIP-1122).
 *
 * A plain `<span>` with inline `var(--g-*)` styles, like the chip it replaces:
 * it renders in the Material subtrees of the table and board (which have no
 * Joy palette and threw on a Joy/Material `<Chip>`), needs no `isDark`, and
 * follows the theme and mode by itself.
 */
export const Tag = ({
    label,
    color,
    fontSize = "var(--g-type-body-xs-size, 0.75rem)",
}: TagProps) => (
    <span style={{ ...chip, fontSize }} title={label}>
        <span
            aria-hidden="true"
            style={{
                flexShrink: 0,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: color,
            }}
        />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </span>
);
