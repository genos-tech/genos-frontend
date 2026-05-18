// Long-lived worker for the tasks category.
import { tasksHandlers } from "./handlers/tasks.handlers";
import { registerHandlers } from "./poolWorker";

registerHandlers(tasksHandlers);

export {};
