import { Stack, IconButton } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { TaskProps } from "../../../../../types/tasks";

type TaskPreviewCustomBarProps = {
    currentTaskContent: TaskProps,
    setCurrentTaskContent: (value: TaskProps) => void,
    setTaskUpdated: (value: boolean) => void,
    setIsCreatingTask: (value: boolean) => void,
}
export const TaskPreviewCustomBar = (props: TaskPreviewCustomBarProps) => {
    const {
        currentTaskContent,
        setCurrentTaskContent,
        setTaskUpdated,
        setIsCreatingTask,
    } = props;

    return (
        <Stack direction="row" sx={{ width: '100%', alignItems: 'center', gap: 1 }}>
            {/* Next Status IconButton */}
            <IconButton
                component="p"
                variant="outlined"
                color="success"
                size='sm'
                sx={{
                    fontSize: '14px',
                    paddingX: '7px',
                }}
                onClick={() => {
                    (async () => {
                        setCurrentTaskContent({
                            ...currentTaskContent,
                            status: { code: 0, status: 'Closed', color: '#1dc200', textColor: 'white' },
                        });
                    })();
                    setTaskUpdated(true)
                }}
            >
                <CheckCircleOutlineIcon sx={{ fontSize: '15px' }} />
                Close
            </IconButton>

            {/* Sub Task IconButton aligned to the right */}
            <IconButton
                component="p"
                variant="outlined"
                size='sm'
                sx={{
                    fontSize: '14px',
                    paddingX: '7px',
                    marginLeft: 'auto',
                }}
                onClick={() => {
                    setIsCreatingTask(true);
                }}
            >
                <AddIcon />
                Sub Task
            </IconButton>

            {/* Delete IconButton */}
            <IconButton
                component="p"
                variant="outlined"
                color="danger"
                size='sm'
                sx={{
                    fontSize: '14px',
                    paddingX: '7px',
                }}
                onClick={() => {
                    (async () => {
                        setCurrentTaskContent({
                            ...currentTaskContent,
                            status: { code: 0, status: 'Deleted', color: '#ff2323', textColor: 'white' },
                        });
                    })();
                    setTaskUpdated(true)
                }}
            >
                <DeleteIcon sx={{ fontSize: '15px' }} />
                Delete
            </IconButton>
        </Stack>
    )
}