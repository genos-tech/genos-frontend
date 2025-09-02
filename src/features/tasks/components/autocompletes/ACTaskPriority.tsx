import { alpha } from "@mui/system";
import { ListItemContent, Chip } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import { useColorScheme } from "@mui/joy/styles";

import { priorities } from "../../utils/taskMeta";
import { TaskProps } from "../../../../types/tasks";

type ACTaskPriorityProps = {
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const ACTaskPriority = (props: ACTaskPriorityProps) => {
    const { taskContents, setTaskContents, setTaskUpdated } = props;

    const { mode } = useColorScheme();

    return (
        <Autocomplete
            key={taskContents.id}
            placeholder="Priority"
            multiple
            options={priorities}
            getOptionLabel={(option) => option.priority || ""}
            value={
                taskContents &&
                taskContents.priority.priority !== null &&
                taskContents.priority.priority !== ""
                    ? [taskContents.priority]
                    : []
            }
            isOptionEqualToValue={(option, value) => option.priority === value.priority}
            renderTags={(tags, getTagProps) =>
                tags.slice(-1).map((item, index) => {
                    const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                    return (
                        <Chip
                            key={key} // pass the key directly
                            variant="soft"
                            sx={{
                                backgroundColor: item.color
                                    ? alpha(item.color, mode === "dark" ? 0.5 : 0.75)
                                    : "transparent",
                                color: item.textColor,
                                fontWeight: "bold",
                                borderRadius: "5px",
                            }}
                            size="sm"
                        >
                            {item.priority}
                        </Chip>
                    );
                })
            }
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={option.priority}>
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <Chip
                            key={option.priority} // pass the key directly
                            variant="soft"
                            sx={{
                                backgroundColor: option.color
                                    ? alpha(option.color, mode === "dark" ? 0.5 : 0.75)
                                    : "transparent",
                                color: option.textColor,
                                fontWeight: "bold",
                                borderRadius: "5px",
                            }}
                            size="sm"
                        >
                            {option.priority}
                        </Chip>
                    </ListItemContent>
                </AutocompleteOption>
            )}
            onChange={(event, value) => {
                if (value !== null) {
                    if (value.length > 0) {
                        (async () => {
                            setTaskContents({
                                ...taskContents,
                                priority: value.slice(-1)[0],
                            });
                            if (setTaskUpdated) {
                                setTaskUpdated(true);
                            }
                        })();
                    } else {
                        (async () => {
                            setTaskContents({
                                ...taskContents,
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
            size="sm"
            sx={{ width: "100%" }}
            openOnFocus={true}
        />
    );
};
