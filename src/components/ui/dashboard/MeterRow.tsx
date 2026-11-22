import { ReactNode } from "react";
import { Box, Typography } from "@mui/joy";

import { g, type } from "../../../theme/tokens";
import { ProportionBar, ProportionBarProps } from "./ProportionBar";

/**
 * One row of the "Team load" list (MIP-1963): avatar, name (ellipsis), a ProportionBar on a
 * scale shared by all rows (pass the same `total`), and a tabular value. 36 px high.
 */
export const MeterRow = ({
    avatar,
    name,
    value,
    segments,
    ariaLabel,
    total,
}: {
    avatar: ReactNode;
    name: string;
    value: string;
} & Pick<ProportionBarProps, "segments" | "ariaLabel" | "total">) => (
    <Box
        sx={{
            display: "grid",
            alignItems: "center",
            gridTemplateColumns: "24px minmax(96px, 160px) minmax(0, 1fr) auto",
            columnGap: 1.5,
            minHeight: g.row.default,
        }}
    >
        {avatar}
        <Typography sx={{ ...type("body-sm"), color: g.text.primary }} title={name} noWrap>
            {name}
        </Typography>
        <ProportionBar ariaLabel={ariaLabel} legend={false} segments={segments} total={total} />
        <Typography
            sx={{
                ...type("body-sm"),
                color: g.text.secondary,
                fontVariantNumeric: "tabular-nums",
                minWidth: 24,
                textAlign: "end",
            }}
        >
            {value}
        </Typography>
    </Box>
);
