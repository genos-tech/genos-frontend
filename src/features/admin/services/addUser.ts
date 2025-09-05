import AddUserWorker from "../../../workers/addUserWorker.ts?worker";
import { UserProps } from "../../../types/admin";

export const addUser = (user: UserProps): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addUserWorker = new AddUserWorker();

        addUserWorker.postMessage({ user: user });

        addUserWorker.onmessage = (event) => {
            addUserWorker.terminate();
            resolve(null);
        };

        addUserWorker.onerror = (error) => {
            addUserWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
