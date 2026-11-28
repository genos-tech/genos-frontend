import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { Box, ListDivider } from "@mui/joy";

import { useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { ProjectStatusDef } from "../../../../types/tasks";
import { predefinedStatusFilters, type FilterProps } from "../../types/TaskTableTypes";
import { STATUS_CATEGORIES } from "../../utils/projectStatus";
import { listedStatuses, pickedStatusId } from "../../utils/statusFilter";
import { StatusLabel } from "../meta/StatusLabel";
import { FilterMenuItem } from "./filterBarParts";

const dividerSx = { my: 0.5, "--Divider-lineColor": g.border.subtle } as const;

const Check = () => (
    <CheckRoundedIcon aria-hidden="true" sx={{ fontSize: 16, color: g.accent.text }} />
);

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

/** A status as its row names and colours it, or the built-in where the category has none. */
const StatusRowLabel = ({ category, row }: { category: string; row?: ProjectStatusDef }) => {
    const { t } = useTranslation();
    return (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
            <StatusLabel row={row} status={category} />
            {row?.isArchived && (
                <Box component="span" sx={{ ...type("caption"), color: g.text.tertiary }}>
                    {t.tasks.projectStatuses.off}
                </Box>
            )}
        </Box>
    );
};

/**
 * The status filter of a project that set up its statuses (MIP-2495): one flat list of them
 * (MIP-2590), never category rows beside them. The selection still holds whole categories where
 * it can (see `statusFilter`), so a picked category ticks each of its statuses. A project
 * without statuses keeps its own flat list.
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
                trailing={
                    <>
                        <Count count={countOf(label)} label={label} />
                        {has(label) && <Check />}
                    </>
                }
                onClick={() => onFilter(filter)}
            >
                {label === "All" || label === "Expired" ? (
                    // No glyph of their own: in the others' ink, and lined up with their words.
                    <Box
                        component="span"
                        sx={{ color: g.text.secondary, paddingInlineStart: 2.5 }}
                    >
                        {labelOf(filter)}
                    </Box>
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
                const listed = listedStatuses(rows, category, selection);
                // One status (or none that is on) IS its category: picking it picks all of
                // it, and the server's count for the category is its count.
                if (listed.length < 2) {
                    const row = listed[0];
                    const on = whole || (row != null && picked.has(row.statusId));
                    return [
                        <FilterMenuItem
                            key={category}
                            aria-checked={on}
                            data-status-category={category}
                            role="menuitemcheckbox"
                            trailing={
                                <>
                                    <Count count={countOf(category)} label={category} />
                                    {on && <Check />}
                                </>
                            }
                            onClick={() =>
                                row && picked.has(row.statusId)
                                    ? onStatus(row)
                                    : onCategory(category)
                            }
                        >
                            <StatusRowLabel category={category} row={row} />
                        </FilterMenuItem>,
                    ];
                }
                return listed.map((row) => {
                    const on = whole || picked.has(row.statusId);
                    return (
                        <FilterMenuItem
                            key={`st:${row.statusId}`}
                            aria-checked={on}
                            data-status-id={row.statusId}
                            role="menuitemcheckbox"
                            trailing={on ? <Check /> : undefined}
                            onClick={() => onStatus(row)}
                        >
                            <StatusRowLabel category={category} row={row} />
                        </FilterMenuItem>
                    );
                });
            })}
            <ListDivider sx={dividerSx} />
            {plain("Expired")}
            {plain("Deleted")}
        </>
    );
};
