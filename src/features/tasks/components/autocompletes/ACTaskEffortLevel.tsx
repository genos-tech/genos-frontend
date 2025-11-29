import { Chip, ListItemContent } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { TaskProps } from "../../../../types/tasks";
import { effortLevels } from "../../utils/taskMeta";

type ACTaskEffortLevelProps = {
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const ACTaskEffortLevel = (props: ACTaskEffortLevelProps) => {
    const { taskContent, setTaskContent, setTaskUpdated } = props;

    const { mode } = useColorScheme();

    return (
        <Autocomplete
            key={`ac-project-effort-level-${taskContent.id}`}
            getOptionLabel={(option) => option.level || ""}
            isOptionEqualToValue={(option, value) => option.level === value.level}
            openOnFocus={true}
            options={effortLevels}
            placeholder="Effort Level"
            size="sm"
            sx={{ width: "100%" }}
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={option.level}>
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <Chip
                            key={option.level} // pass the key directly
                            size="sm"
                            variant="soft"
                            sx={{
                                backgroundColor: option.color
                                    ? alpha(option.color, mode === "dark" ? 0.5 : 1)
                                    : "transparent",
                                color: option.textColor,
                                fontWeight: "bold",
                                borderRadius: "5px",
                            }}
                        >
                            {option.level}
                        </Chip>
                    </ListItemContent>
                </AutocompleteOption>
            )}
            renderTags={(tags, getTagProps) =>
                tags.slice(-1).map((item, index) => {
                    const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                    return (
                        <Chip
                            key={`ac-project-effort-level-${key}`}
                            size="sm"
                            variant="soft"
                            sx={{
                                backgroundColor: item.color
                                    ? alpha(item.color, mode === "dark" ? 0.5 : 1)
                                    : "transparent",
                                color: item.textColor,
                                fontWeight: "bold",
                                borderRadius: "5px",
                            }}
                        >
                            {item.level}
                        </Chip>
                    );
                })
            }
            value={
                taskContent &&
                taskContent.effortLevel.level !== null &&
                taskContent.effortLevel.level !== ""
                    ? [taskContent.effortLevel]
                    : []
            }
            multiple
            onChange={(event, value) => {
                if (value !== null) {
                    if (value.length > 0) {
                        (async () => {
                            setTaskContent({
                                ...taskContent,
                                effortLevel: value.slice(-1)[0],
                            });
                            if (setTaskUpdated) {
                                setTaskUpdated(true);
                            }
                        })();
                    } else {
                        (async () => {
                            setTaskContent({
                                ...taskContent,
                                effortLevel: {
                                    code: 0,
                                    level: null,
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
