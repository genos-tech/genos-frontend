import { Button, Input, Stack } from "@mui/joy";

import { TaskProps } from "../../../../../../types/tasks";
import { getFormattedDateStr, getFormattedTodayDateStr } from "../../../../../../utils/dateUtils";

type TaskDueDateInputProps = {
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const TaskDueDateInput = (props: TaskDueDateInputProps) => {
    const { taskContents, setTaskContents, setTaskUpdated } = props;

    return (
        <Stack alignItems="center" direction="row" justifyContent="center" spacing={1.5}>
            <Input
                color="neutral"
                size="sm"
                type="date"
                value={taskContents.dueDate ? taskContents.dueDate : ""}
                variant="outlined"
                slotProps={{
                    input: {
                        min: getFormattedTodayDateStr(),
                    },
                }}
                onChange={(e) => {
                    setTaskContents({
                        ...taskContents,
                        dueDate: getFormattedDateStr(new Date(e.target.value)),
                    });
                    if (setTaskUpdated) {
                        setTaskUpdated(true);
                    }
                }}
            />
            <Button
                color="neutral"
                component="a"
                size="sm"
                variant="outlined"
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
