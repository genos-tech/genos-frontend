import { Button, Stack, Typography, Input } from "@mui/joy";

import {
    getFormattedDateStr,
    getFormattedTodayDateStr,
    getFormattedNDaysAfterDateStr,
} from "../../../../../../utils/dateUtils";
import { TaskProps } from "../../../../../../types/tasks";

type TaskDueDateInputProps = {
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const TaskDueDateInput = (props: TaskDueDateInputProps) => {
    const { taskContents, setTaskContents, setTaskUpdated } = props;

    return (
        <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
            <Input
                type="date"
                color="neutral"
                variant="outlined"
                size="sm"
                value={taskContents.dueDate ? taskContents.dueDate : ""}
                onChange={(e) => {
                    setTaskContents({
                        ...taskContents,
                        dueDate: getFormattedDateStr(new Date(e.target.value)),
                    });
                    if (setTaskUpdated) {
                        setTaskUpdated(true);
                    }
                }}
                slotProps={{
                    input: {
                        min: getFormattedTodayDateStr(),
                    },
                }}
            />
            <Button
                component="a"
                variant="outlined"
                color="neutral"
                size="sm"
                onClick={() => {
                    setTaskContents({
                        ...taskContents,
                        dueDate: "",
                    });
                    if (setTaskUpdated) {
                        setTaskUpdated(true);
                    }
                }}
            >
                TBD
            </Button>
        </Stack>
    );
};
