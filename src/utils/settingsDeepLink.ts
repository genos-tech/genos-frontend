/**
 * `?settings=<tab>` (MIP-2323): a link that opens Settings on a tab, so the help tool and the
 * manual can answer "where do I change X?" with a link that lands on the right place.
 *
 * The keys are the `SettingsTabKey`s of `src/manual/settingsMap.ts` (the same list the rail
 * shows). An unknown key opens General. The parameter is removed from the address once it has
 * been handed to the modal, so a refresh does not reopen Settings. It adds no UI: it only asks
 * the existing modal (desktop sidebar or phone account sheet) to open, through the same event
 * the "Connect Claude" button uses.
 */
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { requestOpenSettings } from "../components/layout/settingsEvents";
import {
    asSkillsList,
    openSkillsList,
    SKILLS_LIST_PARAM,
} from "../features/genos/skills/openSkillsList";
import { SETTINGS_MAP, type SettingsTabKey } from "../manual/settingsMap";

export const SETTINGS_PARAM = "settings";

const TAB_KEYS: readonly string[] = Object.keys(SETTINGS_MAP);

/** A known tab key, or "general" for anything else (unknown, empty, wrong case). */
export const resolveSettingsTab = (raw: string | null | undefined): SettingsTabKey =>
    raw && TAB_KEYS.includes(raw) ? (raw as SettingsTabKey) : "general";

/** The raw `settings` value in a query string, or null when the parameter is absent. */
export const readSettingsParam = (search: string): string | null =>
    new URLSearchParams(search).get(SETTINGS_PARAM);

/** The query string without `settings` ("" or "?a=b"). Other parameters are kept as they were. */
export const stripSettingsParam = (search: string): string => {
    const params = new URLSearchParams(search);
    params.delete(SETTINGS_PARAM);
    params.delete(SKILLS_LIST_PARAM);
    const rest = params.toString();
    return rest ? `?${rest}` : "";
};

/** Opens Settings on the tab named by `?settings=` the moment the address carries it. */
export const useSettingsDeepLink = (): void => {
    const location = useLocation();
    const navigate = useNavigate();
    const { pathname, search, hash } = location;
    useEffect(() => {
        const raw = readSettingsParam(search);
        if (raw === null) return;
        const tab = resolveSettingsTab(raw);
        // `?settings=spotlight&skills=hub|team` (MIP-2589): the list a skill is installed from.
        const list = asSkillsList(new URLSearchParams(search).get(SKILLS_LIST_PARAM));
        if (list && tab === "spotlight") openSkillsList(list);
        else requestOpenSettings(tab);
        navigate({ pathname, search: stripSettingsParam(search), hash }, { replace: true });
    }, [pathname, search, hash, navigate]);
};
