import { createContext, useContext } from "react";

import { LandingTicket, OpenLanding, passThroughTicket } from "../services/taskOpenLanding";

/**
 * The landing of the task preview this component sits in (MIP-968): the
 * preview provides one; any other host (the create form, the milestone
 * preview, the thread pane) has none and its loaders write at once.
 */
export const TaskOpenLandingContext = createContext<OpenLanding | null>(null);

export const useTaskOpenLanding = (): OpenLanding | null => useContext(TaskOpenLandingContext);

/** Join the open of `taskId`, or get a ticket that writes at once without a landing. */
export const joinOpenLanding = (
    landing: OpenLanding | null,
    taskId: number,
    key: string
): LandingTicket => (landing ? landing.join(taskId, key) : passThroughTicket);
