// Channel registry — exposes one persistent WorkerChannel per category.
//
// Channels lazily spin up their underlying Worker the first time a request
// is made; on worker error, the channel rejects pending promises and clears
// the worker so the next call reconstructs it. See pool.ts for details.

import ActivityWorker from "./activityWorker.ts?worker";
import ChatWorker from "./chatWorker.ts?worker";
import type {
    ActivityRequests,
    ChatRequests,
    InboxRequests,
    NotesRequests,
    TasksRequests,
    UsersRequests,
} from "./contracts";
import InboxWorker from "./inboxWorker.ts?worker";
import NotesWorker from "./notesWorker.ts?worker";
import { WorkerChannel } from "./pool";
import TasksWorker from "./tasksWorker.ts?worker";
import UsersWorker from "./usersWorker.ts?worker";

export const chatChannel = new WorkerChannel<ChatRequests>("chat", () => new ChatWorker());
export const notesChannel = new WorkerChannel<NotesRequests>("notes", () => new NotesWorker());
export const tasksChannel = new WorkerChannel<TasksRequests>("tasks", () => new TasksWorker());
export const inboxChannel = new WorkerChannel<InboxRequests>("inbox", () => new InboxWorker());
export const activityChannel = new WorkerChannel<ActivityRequests>(
    "activity",
    () => new ActivityWorker()
);
export const usersChannel = new WorkerChannel<UsersRequests>("users", () => new UsersWorker());
