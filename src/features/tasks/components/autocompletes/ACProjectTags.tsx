import { ListItemContent } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../../i18n";
import { TagListProps, TaskProps } from "../../../../types/tasks";
import { ProjectTagChip } from "../ProjectTagChip";
import { PickerField, pickerInputProps } from "./pickerField";

type ACProjectTagsProps = {
    projectTags: TagListProps[];
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    isOpenTagList: boolean;
    setIsOpenTagList: (value: boolean) => void;
    setTaskUpdated?: (value: boolean) => void;
    field?: PickerField;
};
export const ACProjectTags = (props: ACProjectTagsProps) => {
    const {
        projectTags,
        taskContent,
        setTaskContent,
        isOpenTagList,
        setIsOpenTagList,
        setTaskUpdated,
        field,
    } = props;

    const { mode } = useColorScheme();
    const { t } = useTranslation();

    return (
        <Autocomplete
            key={`ac-project-tags-${taskContent.id}`}
            error={field?.invalid}
            getOptionLabel={(option) => option.tagName}
            isOptionEqualToValue={(option, value) => option.tagName === value.tagName}
            limitTags={3}
            noOptionsText={field?.noOptions}
            options={projectTags}
            placeholder={t.tasks.autocomplete.tagsPlaceholder}
            size="sm"
            slotProps={{ input: pickerInputProps(field) }}
            sx={{ width: "100%" }}
            value={taskContent ? taskContent.tags : []}
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={`ac-project-tags-name-${option.tagName}`}>
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <ProjectTagChip
                            isDark={mode === "dark"}
                            label={option.tagName}
                            size="md"
                            tagColor={option.tagColor}
                        />
                    </ListItemContent>
                </AutocompleteOption>
            )}
            renderTags={(tags, getTagProps) =>
                tags.map((item, index) => {
                    const { key } = getTagProps({ index });
                    return (
                        <ProjectTagChip
                            key={`ac-project-tags-chip-${key}`}
                            isDark={mode === "dark"}
                            label={item.tagName}
                            size="md"
                            tagColor={item.tagColor}
                        />
                    );
                })
            }
            multiple
            onChange={(event, value) => {
                if (value !== null) {
                    setTaskContent({
                        ...taskContent,
                        tags: value,
                    });
                    if (setTaskUpdated) {
                        setTaskUpdated(true);
                    }
                }
            }}
            onOpen={() => {
                setIsOpenTagList(!isOpenTagList);
            }}
        />
    );
};
