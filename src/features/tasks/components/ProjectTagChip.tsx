import { Tag } from "./meta/Tag";

type ProjectTagChipProps = {
    label: string;
    tagColor: string;
    /** Ignored: the tag follows the theme and mode by itself (MIP-1122). Kept so
     *  the fifteen callers compile; sweeps drop it. */
    isDark?: boolean;
    /** Override the chip's font size. */
    fontSize?: string | number;
};

/**
 * The **project-tag chip** every surface shares (table, sprint board, the
 * dashboard's milestone card, the tag autocomplete): now the shared `Tag`, a
 * neutral chip with the tag's own color as a dot (MIP-1122). It is still a plain
 * `<span>` underneath, so it renders in the Material subtrees of the table and
 * board, which have no Joy palette.
 */
export const ProjectTagChip = ({
    label,
    tagColor,
    // The size the chip always had (0.7rem): the table's tag column is narrow
    // and a larger default truncates "sample-tag".
    fontSize = "var(--table-tag-size, 0.7rem)",
}: ProjectTagChipProps) => <Tag color={tagColor} fontSize={fontSize} label={label} />;
