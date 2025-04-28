import { alpha } from '@mui/system';
import { ListItemContent, Chip } from '@mui/joy';
import Autocomplete from '@mui/joy/Autocomplete';
import AutocompleteOption from '@mui/joy/AutocompleteOption';
import { useColorScheme } from '@mui/joy/styles';

import { effortLevels } from "../../utils/taskMeta";
import { TaskProps } from '../../../../types/tasks';

type ACTaskEffortLevelProps = {
    taskContents: TaskProps,
    setTaskContents: (value: TaskProps) => void,
    setTaskUpdated?: (value: boolean) => void,
}
export const ACTaskEffortLevel = (props: ACTaskEffortLevelProps) => {
    const {
        taskContents,
        setTaskContents,
        setTaskUpdated
    } = props;

    const { mode } = useColorScheme();

    return (
        <Autocomplete
            key={taskContents.id}
            placeholder="Effort Level"
            multiple
            options={effortLevels}
            getOptionLabel={(option) => option.level || ""}
            value={
                (taskContents && taskContents.effortLevel.level !== null && taskContents.effortLevel.level !== "")
                    ? [taskContents.effortLevel]
                    : []
            }
            isOptionEqualToValue={(option, value) => option.level === value.level}
            renderTags={(tags, getTagProps) =>
                tags.slice(-1).map((item, index) => {
                    const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                    return (
                        <Chip
                            key={key} // pass the key directly
                            variant="soft"
                            sx={{
                                backgroundColor: item.color ? alpha(item.color, mode === 'dark' ? 0.5 : 0.75) : 'transparent',
                                color: item.textColor,
                                fontWeight: 'bold',
                                borderRadius: '7px',
                            }}
                            size='sm'
                        >
                            {item.level}
                        </Chip>
                    );
                })
            }
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={option.level}>
                    <ListItemContent sx={{ fontSize: 'sm' }}>
                        <Chip
                            key={option.level} // pass the key directly
                            variant="soft"
                            sx={{
                                backgroundColor: option.color ? alpha(option.color, mode === 'dark' ? 0.5 : 0.75) : 'transparent',
                                color: option.textColor,
                                fontWeight: 'bold',
                                borderRadius: '7px',
                            }}
                            size='sm'
                        >
                            {option.level}
                        </Chip>
                    </ListItemContent>
                </AutocompleteOption>
            )}
            onChange={(event, value) => {
                if (value !== null) {
                    console.log("setTaskUpdated:", setTaskUpdated)
                    if (value.length > 0) {
                        (async () => {
                            setTaskContents({
                                ...taskContents,
                                effortLevel: value.slice(-1)[0]
                            });
                            if (setTaskUpdated) {
                                setTaskUpdated(true);
                            }
                        })();
                    } else {
                        (async () => {
                            setTaskContents({
                                ...taskContents,
                                effortLevel: { code: 0, level: null, color: null, textColor: null }
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
    )
}