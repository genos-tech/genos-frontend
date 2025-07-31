import { alpha } from "@mui/system";
import { ListItemContent, Chip } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import { useColorScheme } from "@mui/joy/styles";

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
                            variant="soft"
                            sx={{
                                backgroundColor: alpha(
                                    item.tagColor,
                                    mode === "dark" ? 0.5 : 0.75
                                ),
                                color: item.tagTextColor,
                                fontWeight: "bold",
                                borderRadius: "7px",
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
                            variant="soft"
                            sx={{
                                backgroundColor: alpha(
                                    option.tagColor,
                                    mode === "dark" ? 0.5 : 0.75
                                ),
                                color: option.tagTextColor,
                                fontWeight: "bold",
                                borderRadius: "7px",
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
