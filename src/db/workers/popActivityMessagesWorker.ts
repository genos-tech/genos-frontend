import { ActivityService } from "../services";
import { UserProps } from "../../types/admin";
import { ActivityMessageProps } from "../../types/chat";

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const activityService = new ActivityService();
    const activityMessages: ActivityMessageProps[] =
        await activityService.getAllActivityMessages();

    // Filter and then sort messages by tsSent in desc
    const sortedActivityMessages = [...activityMessages]
        .filter((msg) => !(msg.activityType === 2 && myself.userId !== msg.senderId))
        .sort((a, b) => new Date(b.tsSent).getTime() - new Date(a.tsSent).getTime());

    self.postMessage(sortedActivityMessages);

    self.close(); // Terminates itself
};

export {};
