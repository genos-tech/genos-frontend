import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { Box, ListDivider } from "@mui/joy";

import { fmt, useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { ProjectStatusDef } from "../../../../types/tasks";
import { predefinedStatusFilters, type FilterProps } from "../../types/TaskTableTypes";
import { STATUS_CATEGORIES, statusRowName } from "../../utils/projectStatus";
import { pickedStatusId, subStatuses } from "../../utils/statusFilter";
import { StatusLabel } from "../meta/StatusLabel";
import { useCategoryName } from "../statuses/useCategoryName";
import { FilterMenuItem } from "./filterBarParts";

const dividerSx = { my: 0.5, "--Divider-lineColor": g.border.subtle } as const;

const Count = ({ label, count }: { label: string; count: number | null }) =>
    count === null ? null : (
        <Box
            component="span"
            data-status-count={label}
            sx={{ color: g.text.tertiary, fontVariantNumeric: "tabular-nums" }}
        >
            {count}
        </Box>
    );

/**
 * The status filter of a project that set up its statuses (MIP-2495): each category, with the
 * project's statuses under it where there is more than one to choose between. A category with
 * only some of them picked shows a dash. A project without statuses keeps the flat list.
 */
export const StatusFilterGroupedMenu = ({
    rows,
    selection,
    countOf,
    onFilter,
    onCategory,
    onStatus,
}: {
    rows: ProjectStatusDef[];
    selection: FilterProps[];
    /** The server's count for a category whose tasks are not loaded yet. */
    countOf: (label: string) => number | null;
    /** All, Expired or Deleted. */
    onFilter: (filter: FilterProps) => void;
    onCategory: (category: string) => void;
    onStatus: (row: ProjectStatusDef) => void;
}) => {
    const { t } = useTranslation();
    const categoryName = useCategoryName();
    const labelOf = (filter: FilterProps) =>
        filter.labelKey ? t.tasks.filters[filter.labelKey] : filter.label;
    const picked = new Set(selection.map(pickedStatusId));
    const has = (label: string) => selection.some((f) => f.label === label);

    // All, Expired, Deleted: the flat list's own entries.
    const plain = (label: string) => {
        const filter = predefinedStatusFilters.find((f) => f.label === label)!;
        return (
            <FilterMenuItem
                key={label}
                aria-checked={has(label)}
                role="menuitemcheckbox"
                selected={has(label)}
                trailing={<Count count={countOf(label)} label={label} />}
                onClick={() => onFilter(filter)}
            >
                {label === "All" || label === "Expired" ? (
                    labelOf(filter)
                ) : (
                    <StatusLabel status={label} />
                )}
            </FilterMenuItem>
        );
    };

    return (
        <>
            {plain("All")}
            <ListDivider sx={dividerSx} />
            {STATUS_CATEGORIES.flatMap((category) => {
                const whole = has(category);
                const subs = subStatuses(rows, category, selection);
                const some = !whole && subs.some((r) => picked.has(r.statusId));
                // A category with one status of the team's own naming says so.
                const only = subs.length
                    ? undefined
                    : rows.find((r) => r.category === category && !r.isArchived);
                const renamed = only && only.name !== (only.builtinKey ?? "") ? only : undefined;
                const count = countOf(category);
                return [
                    <FilterMenuItem
                        key={category}
                        aria-checked={whole ? true : some ? "mixed" : false}
                        data-status-category={category}
                        mark="none"
                        role="menuitemcheckbox"
                        selected={whole}
                        trailing={
                            <>
                                <Count count={count} label={category} />
                                {whole && (
                                    <CheckRoundedIcon aria-hidden="true" sx={{ fontSize: 16 }} />
                                )}
                                {some && (
                                    <RemoveRoundedIcon
                                        aria-hidden="true"
                                        sx={{ fontSize: 16, color: g.accent.text }}
                                    />
                                )}
                            </>
                        }
                        onClick={() => onCategory(category)}
                    >
                        <Box
                            component="span"
                            sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
                        >
                            <StatusLabel status={category} />
                            {renamed && (
                                <Box
                                    component="span"
                                    sx={{ ...type("caption"), color: g.text.tertiary }}
                                >
                                    {statusRowName(renamed, t.tasks)}
                                </Box>
                            )}
                        </Box>
                    </FilterMenuItem>,
                    ...subs.map((row) => {
                        const on = whole || picked.has(row.statusId);
                        return (
                            <FilterMenuItem
                                key={`st:${row.statusId}`}
                                aria-checked={on}
                                data-status-id={row.statusId}
                                role="menuitemcheckbox"
                                selected={on}
                                sx={{ paddingInlineStart: 3.5 }}
                                aria-label={fmt(t.tasks.filters.statusInCategory, {
                                    name: statusRowName(row, t.tasks),
                                    category: categoryName(category),
                                })}
                                onClick={() => onStatus(row)}
                            >
                                <StatusLabel row={row} status={row.category} />
                                {row.isArchived && (
                                    <Box
                                        component="span"
                                        sx={{ ...type("caption"), color: g.text.tertiary }}
                                    >
                                        {t.tasks.projectStatuses.off}
                                    </Box>
                                )}
                            </FilterMenuItem>
                        );
                    }),
                ];
            })}
            <ListDivider sx={dividerSx} />
            {plain("Expired")}
            {plain("Deleted")}
        </>
    );
};
