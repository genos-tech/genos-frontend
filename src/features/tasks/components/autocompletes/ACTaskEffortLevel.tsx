import { ListItemContent } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";

import { useTranslation } from "../../../../i18n";
import { TaskProps } from "../../../../types/tasks";
import { effortLevels, taskMetaLabel } from "../../utils/taskMeta";
import { EffortLabel } from "../table/cellEditors";

type ACTaskEffortLevelProps = {
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const ACTaskEffortLevel = (props: ACTaskEffortLevelProps) => {
    const { taskContent, setTaskContent, setTaskUpdated } = props;

    const { t } = useTranslation();

    return (
        <Autocomplete
            key={`ac-project-effort-level-${taskContent.id}`}
            getOptionLabel={(option) => taskMetaLabel(option.level, t.tasks.filters)}
            isOptionEqualToValue={(option, value) => option.level === value.level}
            openOnFocus={true}
            options={effortLevels}
            placeholder={t.tasks.autocomplete.effortLevelPlaceholder}
            size="sm"
            sx={{ width: "100%" }}
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={option.level}>
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <EffortLabel level={option.level ?? ""} />
                    </ListItemContent>
                </AutocompleteOption>
            )}
            renderTags={(tags, getTagProps) =>
                tags.slice(-1).map((item, index) => {
                    const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                    return <EffortLabel key={key} level={item.level ?? ""} />;
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
