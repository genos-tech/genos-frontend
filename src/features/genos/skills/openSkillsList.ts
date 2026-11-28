/**
 * "Find more skills in the Genos Hub" (MIP-2589): open Settings > Genos > Skills on the list a
 * skill is installed from. Only installed skills can be picked or run, so the pickers, a refused
 * run and a link from outside the app (`?settings=spotlight&skills=hub`) all come here.
 *
 * It adds no surface: it asks the existing Settings dialog to open on the Genos tab (the same
 * request the "Connect Claude" button makes) and the Genos panel switches to its Skills page.
 * Spotlight and the Genos page's schedule dialog listen to the same event and close.
 */
import { requestOpenSettings } from "../../../components/layout/settingsEvents";

export type SkillsList = "hub" | "team";

export const SKILLS_LIST_PARAM = "skills";
export const OPEN_SKILLS_EVENT = "genos:open-skills";

export const asSkillsList = (raw: unknown): SkillsList | null =>
    raw === "hub" || raw === "team" ? raw : null;

// The Settings dialog may mount only after the request (it opens because of it), so the list also
// waits here until the Genos panel takes it. It is dropped after a moment: opening Settings later
// by hand must start on the ordinary Genos settings.
let pending: SkillsList | null = null;
let expiry: ReturnType<typeof setTimeout> | undefined;
const PENDING_MS = 5000;

export const openSkillsList = (list: SkillsList): void => {
    pending = list;
    clearTimeout(expiry);
    expiry = setTimeout(() => {
        pending = null;
    }, PENDING_MS);
    window.dispatchEvent(new CustomEvent<SkillsList>(OPEN_SKILLS_EVENT, { detail: list }));
    requestOpenSettings("spotlight");
};

/** The list asked for and not yet shown, once. */
export const takePendingSkillsList = (): SkillsList | null => {
    const list = pending;
    pending = null;
    clearTimeout(expiry);
    return list;
};
