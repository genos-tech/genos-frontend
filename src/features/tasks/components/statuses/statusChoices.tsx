/**
 * What the grouped status pickers share (the preview's and the table's), so they cannot drift:
 * the category headings and the options of a project that set up statuses (MIP-2493).
 */
import type { CSSProperties } from "react";
import { Box } from "@mui/joy";

import { useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { statusTone, toneCss } from "../../meta/taskTone";
import { taskMetaLabel } from "../../utils/taskMeta";
import { getStatusIcon } from "../meta/statusIcons";

/** The category's name, as the built-in statuses are translated. */
export const useCategoryName = (): ((category: string) => string) => {
    const { t } = useTranslation();
    return (category) => taskMetaLabel(category, t.tasks.filters) || category;
};

/** A group heading: the category's glyph and name, quiet. */
export const CategoryHeading = ({ category }: { category: string }) => {
    const categoryName = useCategoryName();
    const color = toneCss(statusTone(category)).text;
    return (
        <Box
            component="span"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                ...type("caption"),
                color: g.text.tertiary,
            }}
        >
            <span
                aria-hidden="true"
                style={{ display: "inline-flex", color, "--Icon-color": color } as CSSProperties}
            >
                {getStatusIcon(category, 12)}
            </span>
            {categoryName(category)}
        </Box>
    );
};
