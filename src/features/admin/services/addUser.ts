import { usersChannel } from "../../../db/workers/channels";
import { UserProps } from "../../../types/admin";

export const addUser = (user: UserProps): Promise<null> => {
    return usersChannel.request("addUser", { user }).then(() => null);
};
