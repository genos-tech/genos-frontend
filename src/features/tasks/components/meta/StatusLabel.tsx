import type { CSSProperties } from "react";

import { useProjectStatuses } from "../../../../hooks/tasks/useProjectStatuses";
import { useTranslation } from "../../../../i18n";
import { ProjectStatusDef } from "../../../../types/tasks";
import { statusTone, toneCss } from "../../meta/taskTone";
import { resolveStatusRow, rowColorCss, statusRowName } from "../../utils/projectStatus";
import { taskMetaLabel } from "../../utils/taskMeta";
import { getStatusIcon } from "./statusIcons";

type StatusLabelProps = {
    status: string | null | undefined;
    /** The icon alone, with the status as its accessible name. */
    iconOnly?: boolean;
    iconSize?: number;
    /** With the project, the chip says what that project calls the status (MIP-2493).
     *  `status` stays the system value (the category): it picks the icon's shape. */
    projectId?: number | null;
    customStatusId?: number | null;
    /** A specific row to draw (pickers, the editor, history), over the project's lookup. */
    row?: Pick<ProjectStatusDef, "name" | "builtinKey" | "color" | "category"> | null;
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
export const StatusLabel = ({
    status,
    iconOnly = false,
    iconSize = 14,
    projectId,
    customStatusId,
    row: givenRow,
}: StatusLabelProps) => {
    const { t } = useTranslation();
    const name = (status ?? "").trim();
    // A project that never set up statuses lists none, and everything below falls back.
    const { statuses } = useProjectStatuses(givenRow ? null : projectId, customStatusId);
    // No status at all: the dash the old chip showed, not an icon with no words.
    if (!name) return <span style={{ color: "var(--g-text-tertiary)" }}>—</span>;
    const row = (givenRow ?? resolveStatusRow(statuses, name, customStatusId)) as
        | ProjectStatusDef
        | undefined;
    const label = row ? statusRowName(row, t.tasks) : taskMetaLabel(name, t.tasks.filters) || name;
    const color = row ? rowColorCss(row) : toneCss(statusTone(name)).text;
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
                        color,
                        // Joy's SvgIcon colors itself from --Icon-color (falling back to a gray
                        // palette role), so `color` on the wrapper alone leaves the icon gray.
                        "--Icon-color": color,
                    } as CSSProperties
                }
            >
                {getStatusIcon(name, iconSize)}
            </span>
            {!iconOnly && (
                <span
                    style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                    // A team's name can be cut off in a narrow column.
                    title={row && !row.builtinKey ? label : undefined}
                    data-status-word
                >
                    {label}
                </span>
            )}
        </span>
    );
};
