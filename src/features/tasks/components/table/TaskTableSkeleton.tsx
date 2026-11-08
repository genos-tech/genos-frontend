import { Box, Skeleton } from "@mui/joy";

import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";

/**
 * The task table while its rows load (MIP-1242). The generic `SkeletonRows` drew
 * full-width bars, so the layout jumped when the real rows landed: no gutter, no
 * columns, bars where the status pill and the id should be. This keeps the header's
 * own geometry: the leading gutter and each visible column at the width the header
 * has (resized columns included), the user's row height, and a bar shaped like what
 * the cell will hold (an id, a status pill, tag chips, a title, a date). Nothing moves
 * when the data arrives, and the columns line up under their headers from the first
 * frame.
 *
 * It takes plain numbers (field / width / align) so it does not import the table.
 */

export type TaskTableSkeletonColumn = {
    field: string;
    width: number;
    align?: "left" | "center" | "right";
};

type Props = {
    columns: readonly TaskTableSkeletonColumn[];
    /** Width of the leading gutter (drag handle + quick-add), same as the header's. */
    gutterWidth: number;
    rows?: number;
    /** Accessible name; defaults to the localized "Loading tasks". */
    label?: string;
};

// The left border of a real row (depth / selected marker): the skeleton keeps the same inset.
const ROW_MARKER = 3;

// The expand cell is 17px in the header and in a real row (its 16px and a 1px border).
const EXPAND_BORDER = 1;

type Shape = "none" | "id" | "pill" | "chips" | "title" | "value";

// The built-in columns by what their cell holds; any other column (a custom field) is a value.
const SHAPES: Record<string, Shape> = {
    __expand: "none",
    id: "id",
    status: "pill",
    priority: "pill",
    tags: "chips",
    title: "title",
};

// Joy's pulse is decoration: still under `prefers-reduced-motion`.
const still = {
    "@media (prefers-reduced-motion: reduce)": {
        animation: "none",
        "&::after": { animation: "none" },
    },
} as const;

// Title widths cycle so a column of bars does not read as a rigid grid.
const TITLE_WIDTHS = ["78%", "52%", "66%", "44%", "72%", "58%"];

const Bar = ({ width, height = 12 }: { width: number | string; height?: number }) => (
    <Skeleton
        height={height}
        sx={{ borderRadius: g.radius.xs, flexShrink: 0, ...still }}
        variant="rectangular"
        width={width}
    />
);

const Cell = ({ shape, row }: { shape: Shape; row: number }) => {
    switch (shape) {
        case "none":
            return null;
        case "id":
            return <Bar width="62%" />;
        case "pill":
            return (
                <Skeleton
                    height={18}
                    sx={{ borderRadius: g.radius.full, ...still }}
                    variant="rectangular"
                    width="72%"
                />
            );
        case "chips":
            return (
                <Box sx={{ display: "flex", gap: 0.5, minWidth: 0, overflow: "hidden" }}>
                    <Bar height={16} width={36} />
                    {row % 2 === 0 && <Bar height={16} width={28} />}
                </Box>
            );
        case "title":
            return <Bar width={TITLE_WIDTHS[row % TITLE_WIDTHS.length]} />;
        default:
            return <Bar width="50%" />;
    }
};

export const TaskTableSkeleton = ({ columns, gutterWidth, rows = 8, label }: Props) => {
    const { t } = useTranslation();
    const widthOf = (c: TaskTableSkeletonColumn) =>
        c.width + (c.field === "__expand" ? EXPAND_BORDER : 0);
    const total = gutterWidth + columns.reduce((sum, c) => sum + widthOf(c), 0);
    return (
        <Box
            aria-busy="true"
            aria-label={label ?? t.tasks.table.loadingTasks}
            data-skeleton="task-table"
            role="status"
            sx={{ display: "flex", flexDirection: "column", minWidth: total + ROW_MARKER }}
        >
            {Array.from({ length: rows }, (_, row) => (
                <Box
                    key={row}
                    data-skeleton-row=""
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        // The row height the real rows have (Settings > Appearance > Density).
                        minHeight: g.row.current,
                        borderBottom: `1px solid ${g.border.subtle}`,
                        // A real row keeps 3px here for its selected / depth marker.
                        borderLeft: `${ROW_MARKER}px solid transparent`,
                    }}
                >
                    <Box sx={{ width: gutterWidth, minWidth: gutterWidth, flexShrink: 0 }} />
                    {columns.map((col) => (
                        <Box
                            key={col.field}
                            data-skeleton-col={col.field}
                            sx={{
                                boxSizing: "border-box",
                                display: "flex",
                                alignItems: "center",
                                justifyContent:
                                    col.align === "center"
                                        ? "center"
                                        : col.align === "right"
                                          ? "flex-end"
                                          : "flex-start",
                                width: widthOf(col),
                                minWidth: widthOf(col),
                                flexShrink: 0,
                                px: 1,
                                overflow: "hidden",
                            }}
                        >
                            <Cell row={row} shape={SHAPES[col.field] ?? "value"} />
                        </Box>
                    ))}
                </Box>
            ))}
        </Box>
    );
};
