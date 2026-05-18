// Long-lived worker for the users category.
import { usersHandlers } from "./handlers/users.handlers";
import { registerHandlers } from "./poolWorker";

registerHandlers(usersHandlers);

export {};
