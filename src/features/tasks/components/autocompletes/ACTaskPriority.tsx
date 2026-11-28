import { ListItemContent } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";

import { useTranslation } from "../../../../i18n";
import { TaskProps } from "../../../../types/tasks";
import { priorities, taskMetaLabel } from "../../utils/taskMeta";
import { PriorityIcon } from "../meta/PriorityIcon";
import { PickerField, pickerInputProps } from "./pickerField";

type ACTaskPriorityProps = {
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
    field?: PickerField;
};
export const ACTaskPriority = (props: ACTaskPriorityProps) => {
    const { taskContent, setTaskContent, setTaskUpdated, field } = props;

    const { t } = useTranslation();

    return (
        <Autocomplete
            key={taskContent.id}
            error={field?.invalid}
            noOptionsText={field?.noOptions}
            getOptionLabel={(option) => taskMetaLabel(option.priority, t.tasks.filters)}
            isOptionEqualToValue={(option, value) => option.priority === value.priority}
            openOnFocus={true}
            options={priorities}
            placeholder={t.tasks.autocomplete.priorityPlaceholder}
            size="sm"
            slotProps={{ input: pickerInputProps(field) }}
            sx={{ width: "100%" }}
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={option.priority}>
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <PriorityIcon priority={option.priority} showLabel />
                    </ListItemContent>
                </AutocompleteOption>
            )}
            renderTags={(tags, getTagProps) =>
                tags.slice(-1).map((item, index) => {
                    const { key } = getTagProps({ index }); // only the 'key' is needed
                    return <PriorityIcon key={key} priority={item.priority} showLabel />;
                })
            }
            value={
                taskContent &&
                taskContent.priority.priority !== null &&
                taskContent.priority.priority !== ""
                    ? [taskContent.priority]
                    : []
            }
            multiple
            onChange={(event, value) => {
                if (value !== null) {
                    if (value.length > 0) {
                        (async () => {
                            setTaskContent({
                                ...taskContent,
                                priority: value.slice(-1)[0],
                            });
                            if (setTaskUpdated) {
                                setTaskUpdated(true);
                            }
                        })();
                    } else {
                        (async () => {
                            setTaskContent({
                                ...taskContent,
                                priority: {
                                    code: 0,
                                    priority: null,
                                    color: null,
                                    textColor: null,
                                },
                            });
                            if (setTaskUpdated) {
                                setTaskUpdated(true);
                            }
                        })();
                    }
                }
            }}
        />
    );
};
