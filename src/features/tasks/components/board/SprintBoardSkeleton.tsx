import { Box, Skeleton } from "@mui/joy";

import { g } from "../../../../theme/tokens";

type Props = {
    /** One entry per status column, in board order. */
    columns: ReadonlyArray<{ id: string; title: string }>;
    /** The board container's own style (grid, gap, padding), so nothing moves when the cards land. */
    containerStyle: React.CSSProperties;
    /** Accessible name; defaults to the localized "Loading tasks". */
    label: string;
};

const CARDS_PER_COLUMN = 3;

/**
 * The sprint board while the first read of a project is in flight (MIP-1308). Until now
 * the board drew its five empty columns for that second, which reads as "this project has
 * no tasks". This keeps the board's own grid and the column titles, and shows card-shaped
 * placeholders in each column, so the columns do not move when the cards arrive.
 */
export const SprintBoardSkeleton = ({ columns, containerStyle, label }: Props) => (
    <div aria-busy="true" aria-label={label} role="status" style={containerStyle}>
        {columns.map((column) => (
            <Box
                key={column.id}
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    minWidth: 0,
                    minHeight: 0,
                    p: 1.25,
                    overflow: "hidden",
                    background: g.surface.default,
                    border: `1px solid ${g.border.subtle}`,
                    borderRadius: g.radius.md,
                }}
            >
                <Box sx={{ color: g.text.tertiary, fontSize: "0.7rem", fontWeight: 600, px: 0.5 }}>
                    {column.title}
                </Box>
                {Array.from({ length: CARDS_PER_COLUMN }, (_, i) => (
                    <Box
                        key={i}
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                            p: 1.25,
                            borderRadius: g.radius.md,
                            border: `1px solid ${g.border.subtle}`,
                            background: g.surface.default,
                        }}
                    >
                        <Skeleton
                            height={10}
                            sx={{ position: "relative", width: "35%" }}
                            variant="text"
                        />
                        <Skeleton
                            height={12}
                            sx={{ position: "relative", width: "85%" }}
                            variant="text"
                        />
                        <Skeleton
                            height={12}
                            sx={{ position: "relative", width: "60%" }}
                            variant="text"
                        />
                    </Box>
                ))}
            </Box>
        ))}
    </div>
);
