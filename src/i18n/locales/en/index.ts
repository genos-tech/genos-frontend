import { admin } from "./admin";
import { app } from "./app";
import { calendar } from "./calendar";
import { chat } from "./chat";
import { common } from "./common";
import { history } from "./history";
import { inbox } from "./inbox";
import { layout } from "./layout";
import { notes } from "./notes";
import { services } from "./services";
import { settings } from "./settings";
import { sidebar } from "./sidebar";
import { spotlight } from "./spotlight";
import { tasks } from "./tasks";
import { threadAsk } from "./threadAsk";

export const en = {
    common,
    app,
    sidebar,
    layout,
    settings,
    chat,
    tasks,
    notes,
    inbox,
    spotlight,
    threadAsk,
    services,
    admin,
    calendar,
    history,
} as const;
