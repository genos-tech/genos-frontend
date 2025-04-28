import { alpha } from '@mui/system';
import { ListItemContent, Chip } from '@mui/joy';
import Autocomplete from '@mui/joy/Autocomplete';
import AutocompleteOption from '@mui/joy/AutocompleteOption';
import { useColorScheme } from '@mui/joy/styles';

import { statuses } from "../../utils/taskMeta";
import { TaskProps } from '../../../../types/tasks';

type ACTaskStatusProps = {
    taskContents: TaskProps,
    setTaskContents: (value: TaskProps) => void,
    setTaskUpdated?: (value: boolean) => void,
}
export const ACTaskStatus = (props: ACTaskStatusProps) => {
    const {
        taskContents,
        setTaskContents,
        setTaskUpdated
    } = props;

    const { mode } = useColorScheme();

    return (
        <Autocomplete
            key={taskContents.id}
            placeholder="Status"
            multiple
            options={statuses}
            value={taskContents ? [taskContents.status] : []}
            getOptionLabel={(option) => option.status || ""}
            isOptionEqualToValue={(option, value) => option.status === value.status}
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
                            {(item) ? item.status : ""}
                        </Chip>
                    );
                })
            }
            renderOption={(props, option) => (
                <AutocompleteOption  {...props} key={option.status}>
                    <ListItemContent sx={{ fontSize: 'sm' }}>
                        <Chip
                            key={option.status} // pass the key directly
                            variant="soft"
                            sx={{
                                backgroundColor: option.color ? alpha(option.color, mode === 'dark' ? 0.5 : 0.75) : 'transparent',
                                color: option.textColor,
                                fontWeight: 'bold',
                                borderRadius: '7px',
                            }}
                            size='sm'
                        >
                            {option.status}
                        </Chip>
                    </ListItemContent>
                </AutocompleteOption>
            )}
            onChange={(event, value) => {
                if (value !== null && value.length > 0) {
                    (async () => {
                        setTaskContents({
                            ...taskContents,
                            status: value.slice(-1)[0]
                        });
                        if (setTaskUpdated) {
                            setTaskUpdated(true);
                        }
                    })();
                }
            }}
            size="sm"
            sx={{ width: "100%" }}
        />
    )
}