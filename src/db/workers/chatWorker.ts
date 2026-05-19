// Long-lived worker for the chat category. Imported by the main thread via
// Vite's `?worker` query and reused for the lifetime of the page. See
// pool.ts for the dispatch model.

import { chatHandlers } from "./handlers/chat.handlers";
import { registerHandlers } from "./poolWorker";

registerHandlers(chatHandlers);

export {};
