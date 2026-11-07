import type { CSSProperties } from "react";

import { useTranslation } from "../../../../i18n";
import { statusTone, toneCss } from "../../meta/taskTone";
import { taskMetaLabel } from "../../utils/taskMeta";
import { getStatusIcon } from "./statusIcons";

type StatusLabelProps = {
    status: string | null | undefined;
    /** The icon alone, with the status as its accessible name. */
    iconOnly?: boolean;
    iconSize?: number;
};

/**
 * A task status: the color is in the ICON, the words stay in the neutral text
 * color (MIP-1122, as proposed on /workspace/design). A column of fifty
 * statuses is then fifty small icons, not fifty colored pills, and the status
 * is still told apart by shape and by its name.
 *
 * Colors are `var(--g-*)` references, so it follows the theme and mode with no
 * `isDark` prop. Plain spans on purpose: it must render in the Material
 * subtrees of the table and board, which have no Joy palette.
 */
export const StatusLabel = ({ status, iconOnly = false, iconSize = 14 }: StatusLabelProps) => {
    const { t } = useTranslation();
    const name = (status ?? "").trim();
    // No status at all: the dash the old chip showed, not an icon with no words.
    if (!name) return <span style={{ color: "var(--g-text-tertiary)" }}>—</span>;
    const label = taskMetaLabel(name, t.tasks.filters) || name;
    const tone = statusTone(name);
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minWidth: 0,
                // An icon alone never shrinks: in a narrow row it used to be squeezed
                // to nothing while its glyph overflowed onto the title beside it.
                ...(iconOnly ? { flexShrink: 0 } : {}),
                color: "var(--g-text-secondary)",
                fontSize: "var(--g-type-body-sm-size, 0.8125rem)",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
            }}
            {...(iconOnly ? { role: "img", "aria-label": label } : {})}
        >
            <span
                aria-hidden="true"
                style={
                    {
                        display: "inline-flex",
                        flexShrink: 0,
                        color: toneCss(tone).text,
                        // Joy's SvgIcon colors itself from --Icon-color (falling back to a gray
                        // palette role), so `color` on the wrapper alone leaves the icon gray.
                        "--Icon-color": toneCss(tone).text,
                    } as CSSProperties
                }
            >
                {getStatusIcon(name, iconSize)}
            </span>
            {!iconOnly && (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
            )}
        </span>
    );
};
