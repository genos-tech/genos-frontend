import { Chip, ListItemContent } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { useTranslation } from "../../../../i18n";
import { TagListProps, TaskProps } from "../../../../types/tasks";

type ACProjectTagsProps = {
    projectTags: TagListProps[];
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    isOpenTagList: boolean;
    setIsOpenTagList: (value: boolean) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const ACProjectTags = (props: ACProjectTagsProps) => {
    const {
        projectTags,
        taskContent,
        setTaskContent,
        isOpenTagList,
        setIsOpenTagList,
        setTaskUpdated,
    } = props;

    const { mode } = useColorScheme();
    const { t } = useTranslation();

    return (
        <Autocomplete
            key={`ac-project-tags-${taskContent.id}`}
            getOptionLabel={(option) => option.tagName}
            isOptionEqualToValue={(option, value) => option.tagName === value.tagName}
            limitTags={3}
            options={projectTags}
            placeholder={t.tasks.autocomplete.tagsPlaceholder}
            size="sm"
            sx={{ width: "100%" }}
            value={taskContent ? taskContent.tags : []}
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={`ac-project-tags-name-${option.tagName}`}>
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <Chip
                            key={`ac-project-tags-name-chip-${option.tagName}`}
                            size="sm"
                            variant="outlined"
                            sx={{
                                color: mode === "dark" ? "white" : "black",
                                fontWeight: "bold",
                                borderRadius: "5px",
                                borderWidth: "3px",
                                borderColor: alpha(option.tagColor, mode === "dark" ? 0.5 : 0.75),
                            }}
                        >
                            {option.tagName}
                        </Chip>
                    </ListItemContent>
                </AutocompleteOption>
            )}
            renderTags={(tags, getTagProps) =>
                tags.map((item, index) => {
                    const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                    return (
                        <Chip
                            key={`ac-project-tags-chip-${key}`}
                            size="sm"
                            variant="outlined"
                            sx={{
                                color: mode === "dark" ? "white" : "black",
                                fontWeight: "bold",
                                borderRadius: "5px",
                                borderWidth: "3px",
                                borderColor: alpha(item.tagColor, mode === "dark" ? 0.5 : 0.75),
                            }}
                        >
                            {item.tagName}
                        </Chip>
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
