import { memo } from "react";
import { Box } from "@mui/joy";
import type { NodeProps } from "@xyflow/react";

import { useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import type { BandLabelData } from "../utils/layoutDiagramGraph";

/**
 * The caption over a band of outside tasks (MIP-1683): the band on the left holds tasks that block
 * a card of this graph, the one on the right holds tasks a card of this graph blocks. A caption,
 * not a card: it takes no clicks and has no handles.
 */
export const BandLabelNode = memo(({ data }: NodeProps) => {
    const { t } = useTranslation();
    const side = (data as BandLabelData).side;
    return (
        <Box
            data-band-label={side}
            sx={{
                ...type("caption"),
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                px: 0.5,
                color: g.text.tertiary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                borderBottom: `1px dashed ${g.border.default}`,
            }}
        >
            {side === "blockers" ? t.tasks.diagram.bands.blockers : t.tasks.diagram.bands.blocked}
        </Box>
    );
});

BandLabelNode.displayName = "BandLabelNode";
