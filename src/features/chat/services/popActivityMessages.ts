import { activityChannel } from "../../../db/workers/channels";
import { UserProps } from "../../../types/admin";
import { ActivityMessageProps } from "../../../types/chat";

export const popActivityMessages = (myself: UserProps): Promise<ActivityMessageProps[]> => {
    return activityChannel.request("popActivityMessages", { myself });
};
