// Long-lived worker for the notes category.
import { notesHandlers } from "./handlers/notes.handlers";
import { registerHandlers } from "./poolWorker";

registerHandlers(notesHandlers);

export {};
