import { admin } from "./admin";
import { app } from "./app";
import { calendar } from "./calendar";
import { chat } from "./chat";
import { common } from "./common";
import { featuresPage } from "./featuresPage";
import { history } from "./history";
import { inbox } from "./inbox";
import { layout } from "./layout";
import { noteAsk } from "./noteAsk";
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
    noteAsk,
    services,
    admin,
    calendar,
    history,
    featuresPage,
} as const;
