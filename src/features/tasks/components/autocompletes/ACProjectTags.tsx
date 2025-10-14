import { Chip, ListItemContent } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { TagListProps, TaskProps } from "../../../../types/tasks";

type ACProjectTagsProps = {
    projectTags: TagListProps[];
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
    isOpenTagList: boolean;
    setIsOpenTagList: (value: boolean) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const ACProjectTags = (props: ACProjectTagsProps) => {
    const {
        projectTags,
        taskContents,
        setTaskContents,
        isOpenTagList,
        setIsOpenTagList,
        setTaskUpdated,
    } = props;

    const { mode } = useColorScheme();

    return (
        <Autocomplete
            key={`ac-project-tags-${taskContents.id}`}
            placeholder="Tags"
            multiple
            options={projectTags}
            getOptionLabel={(option) => option.tagName}
            value={taskContents ? taskContents.tags : []}
            isOptionEqualToValue={(option, value) => option.tagName === value.tagName}
            limitTags={3}
            renderTags={(tags, getTagProps) =>
                tags.map((item, index) => {
                    const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                    return (
                        <Chip
                            key={`ac-project-tags-chip-${key}`}
                            variant="outlined"
                            sx={{
                                color: mode === "dark" ? "white" : "black",
                                fontWeight: "bold",
                                borderRadius: "5px",
                                borderWidth: "3px",
                                borderColor: alpha(item.tagColor, mode === "dark" ? 0.5 : 0.75),
                            }}
                            size="sm"
                        >
                            {item.tagName}
                        </Chip>
                    );
                })
            }
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={`ac-project-tags-name-${option.tagName}`}>
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <Chip
                            key={`ac-project-tags-name-chip-${option.tagName}`}
                            variant="outlined"
                            sx={{
                                color: mode === "dark" ? "white" : "black",
                                fontWeight: "bold",
                                borderRadius: "5px",
                                borderWidth: "3px",
                                borderColor: alpha(option.tagColor, mode === "dark" ? 0.5 : 0.75),
                            }}
                            size="sm"
                        >
                            {option.tagName}
                        </Chip>
                    </ListItemContent>
                </AutocompleteOption>
            )}
            onChange={(event, value) => {
                if (value !== null) {
                    setTaskContents({
                        ...taskContents,
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
            size="sm"
            sx={{ width: "100%" }}
        />
    );
};
