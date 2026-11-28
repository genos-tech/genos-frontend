import { Fragment } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { Box, ListDivider } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";

import { useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { ProjectStatusDef } from "../../../../types/tasks";
import { STATUS_DELETED } from "../../meta/taskStatuses";
import { pickableStatuses, resolveStatusRow, statusRowName } from "../../utils/projectStatus";
import { taskMetaLabel } from "../../utils/taskMeta";
import { PickerField, pickerInputProps } from "../autocompletes/pickerField";
import { StatusLabel } from "../meta/StatusLabel";

/** One of the project's statuses, or a bare system value (Deleted, or a category whose
 *  statuses are all off, which a task can still be in). */
type Choice = { key: string; category: string; row: ProjectStatusDef | null };

const systemChoice = (category: string): Choice => ({ key: category, category, row: null });
const rowChoice = (row: ProjectStatusDef): Choice => ({
    key: `st:${row.statusId}`,
    category: row.category,
    row,
});

/**
 * The status field of a project that set up its statuses (MIP-2493): its own statuses in one
 * flat list (MIP-2590: the category each counts as stays under the hood), with Deleted apart
 * at the end where it is offered.
 */
export const ProjectStatusPicker = ({
    rows,
    status,
    customStatusId,
    offerDelete,
    onPick,
    field,
}: {
    rows: ProjectStatusDef[];
    status: string;
    customStatusId?: number | null;
    offerDelete: boolean;
    /** `statusId` is undefined for a bare system value. */
    onPick: (category: string, statusId?: number) => void;
    field?: PickerField;
}) => {
    const { t } = useTranslation();
    const current = resolveStatusRow(rows, status, customStatusId);
    const value = current ? rowChoice(current) : status ? systemChoice(status) : null;
    const options: Choice[] = [
        ...pickableStatuses(rows, current?.statusId).map(rowChoice),
        ...(offerDelete || status === STATUS_DELETED ? [systemChoice(STATUS_DELETED)] : []),
    ];
    const name = (choice: Choice): string =>
        choice.row
            ? statusRowName(choice.row, t.tasks)
            : taskMetaLabel(choice.category, t.tasks.filters) || choice.category;

    return (
        <Autocomplete
            error={field?.invalid}
            getOptionLabel={name}
            isOptionEqualToValue={(option, selected) => option.key === selected.key}
            noOptionsText={field?.noOptions}
            options={options}
            placeholder={t.tasks.autocomplete.statusPlaceholder}
            size="sm"
            slotProps={{ input: pickerInputProps(field) }}
            sx={{ width: "100%" }}
            value={value ? [value] : []}
            renderOption={(props, option) => (
                <Fragment key={option.key}>
                    {option.key === STATUS_DELETED && <ListDivider />}
                    <AutocompleteOption {...props} sx={{ minHeight: 32 }}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                width: "100%",
                                minWidth: 0,
                            }}
                        >
                            <StatusLabel row={option.row} status={option.category} />
                            {option.row?.isArchived && (
                                <Box
                                    component="span"
                                    sx={{ ...type("caption"), color: g.text.tertiary }}
                                >
                                    {t.tasks.projectStatuses.off}
                                </Box>
                            )}
                            {props["aria-selected"] === true && (
                                <CheckRoundedIcon
                                    aria-hidden="true"
                                    sx={{ fontSize: 16, marginInlineStart: "auto" }}
                                />
                            )}
                        </Box>
                    </AutocompleteOption>
                </Fragment>
            )}
            renderTags={(tags, getTagProps) =>
                tags.slice(-1).map((item, index) => {
                    const { key } = getTagProps({ index }); // only the 'key' is needed
                    return <StatusLabel key={key} row={item.row} status={item.category} />;
                })
            }
            multiple
            onChange={(_event, next) => {
                const picked = next?.slice(-1)[0];
                if (picked) onPick(picked.category, picked.row?.statusId);
            }}
        />
    );
};
