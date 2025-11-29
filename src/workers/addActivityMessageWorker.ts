import { ActivityService } from "../db/services/activity.service";
import { ActivityMessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const activityMessage: ActivityMessageProps = event.data.activityMessage;

    const activityService = new ActivityService();
    await activityService.addActivityMessage(activityMessage);

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
