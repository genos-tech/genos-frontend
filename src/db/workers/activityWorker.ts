// Long-lived worker for the activity category.
import { activityHandlers } from "./handlers/activity.handlers";
import { registerHandlers } from "./poolWorker";

registerHandlers(activityHandlers);

export {};
