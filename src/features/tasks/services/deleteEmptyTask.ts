import { UserProps } from "../../../types/admin";

const base_url = import.meta.env.VITE_API_BASE_URL;

type deleteEmptyTaskProps = {
    myself: UserProps;
    taskId: number;
    accessToken: string | null;
    setInitialEmptyTaskId?: (value: number | undefined) => void;
};

export const deleteEmptyTask = async (props: deleteEmptyTaskProps) => {
    const { myself, taskId, accessToken, setInitialEmptyTaskId } = props;

    if (accessToken) {
        const taskCreateResponse = await fetch(
            `${base_url}/task/?team_id=${myself.teamId}&task_id=${taskId}&is_init_task_boolean=1`,
            {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        if (!taskCreateResponse.ok) {
            throw new Error("Failed to delete the empty task");
        } else {
            if (setInitialEmptyTaskId) {
                setInitialEmptyTaskId(undefined);
            }
        }
    }
};
