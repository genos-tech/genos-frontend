import { UserProps } from "../../../types/admin";
import PopTeamMembersWorker from "../../../workers/popTeamMembersWorker.ts?worker";

export const popTeamMembers = (myself: UserProps): Promise<UserProps[]> => {
    return new Promise((resolve, reject) => {
        const popTeamMembersWorker = new PopTeamMembersWorker();

        popTeamMembersWorker.postMessage({ myself });

        popTeamMembersWorker.onmessage = (event) => {
            popTeamMembersWorker.terminate();
            resolve(event.data as UserProps[]);
        };

        popTeamMembersWorker.onerror = (error) => {
            popTeamMembersWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
