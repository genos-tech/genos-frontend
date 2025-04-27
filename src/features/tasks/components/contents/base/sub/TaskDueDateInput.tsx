import { Button, Stack, Typography, Input } from '@mui/joy';

import { getFormattedDateStr, getFormattedTodayDateStr } from '../../../../../../components/utils/dateUtils';
import { TaskProps } from '../../../../../../types/tasks';

type TaskDueDateInputProps = {
    taskContents: TaskProps,
    setTaskContents: (value: TaskProps) => void,
}
export const TaskDueDateInput = (props: TaskDueDateInputProps) => {
    const {
        taskContents,
        setTaskContents
    } = props;

    return (
        <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
            <Typography sx={{ minWidth: "100px" }}>Due Date:</Typography>
            <Input
                type="date"
                color="neutral"
                variant="outlined"
                size="sm"
                value={(taskContents.dueDate) ? taskContents.dueDate : ""}
                onChange={(e) => {
                    setTaskContents({
                        ...taskContents,
                        dueDate: getFormattedDateStr(new Date(e.target.value)),
                    });
                }}
                slotProps={{
                    input: {
                        min: getFormattedTodayDateStr(),
                    },
                }}
            />
            <Button
                component='a'
                variant="outlined"
                color="neutral"
                size='sm'
                onClick={() => {
                    setTaskContents({
                        ...taskContents,
                        dueDate: ""
                    });
                }}>
                TBD
            </Button>
        </Stack>
    )
}