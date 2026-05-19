// Long-lived worker for the inbox category.
import { inboxHandlers } from "./handlers/inbox.handlers";
import { registerHandlers } from "./poolWorker";

registerHandlers(inboxHandlers);

export {};
