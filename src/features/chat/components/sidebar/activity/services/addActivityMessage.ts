import { activityChannel } from "../../../../../../db/workers/channels";
import { ActivityMessageProps } from "../../../../../../types/chat";

export const addActivityMessage = (activityMessage: ActivityMessageProps): Promise<null> => {
    return activityChannel.request("addActivityMessage", { activityMessage }).then(() => null);
};
