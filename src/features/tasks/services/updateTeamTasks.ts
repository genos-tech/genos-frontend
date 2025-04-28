import { UserProps } from '../../../types/admin';
import { ThreadMessageProps } from '../../../types/chat';
import LoadTeamTaskWorker from "../../../workers/loadTeamTaskWorker.ts?worker";

export const updateTeamTasks = (
    myself: UserProps,
    accessToken: string | null
) => {
    return new Promise((resolve, reject) => {
        const popLoadTeamTaskWorker = new LoadTeamTaskWorker();

        popLoadTeamTaskWorker.postMessage({
            myself,
            accessToken
        });

        popLoadTeamTaskWorker.onmessage = (event) => {
            popLoadTeamTaskWorker.terminate();
            resolve(event.data as ThreadMessageProps[]);
        };

        popLoadTeamTaskWorker.onerror = (error) => {
            popLoadTeamTaskWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
