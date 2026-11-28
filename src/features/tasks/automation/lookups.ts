/**
 * The names a rule's ids stand for: this project's people, tags, milestones, custom fields and
 * statuses, and the projects a rule may move into.
 */
import { createContext, useContext, useEffect, useState } from "react";

import { useAuth } from "../../../context/authState";
import { useProjectCustomFields } from "../../../hooks/tasks/useProjectCustomFields";
import { useProjectStatuses } from "../../../hooks/tasks/useProjectStatuses";
import type { UserProps } from "../../../types/admin";
import type { ProjectCustomFieldDef, ProjectProps, ProjectStatusDef } from "../../../types/tasks";
import { loadProjectMilestones } from "../sprint-milestone/services/loadProjectMilestones";
import type { Milestone } from "../sprint-milestone/types";
import { sortStatuses, STATUS_CATEGORIES } from "../utils/projectStatus";
import type { StatusPick } from "./draft";

export type AutomationContextData = {
    /** The team's projects as the app lists them (`usePM.teamProjects`). */
    projects: ProjectProps[];
    members: UserProps[];
    myUserId: string;
};

export type Lookups = AutomationContextData & {
    projectId: number;
    current: ProjectProps | undefined;
    statuses: ProjectStatusDef[];
    fields: ProjectCustomFieldDef[];
    milestones: Milestone[];
    /** The layer popups of this dialog open at. */
    popupZ: number;
};

export const LookupsContext = createContext<Lookups | null>(null);

export const useLookups = (): Lookups => {
    const value = useContext(LookupsContext);
    if (!value) throw new Error("LookupsContext is missing");
    return value;
};

export const useRuleLookups = (
    projectId: number,
    data: AutomationContextData,
    popupZ: number,
    enabled: boolean
): Lookups => {
    const { accessToken } = useAuth();
    const { statuses } = useProjectStatuses(enabled ? projectId : null);
    const { fields } = useProjectCustomFields(enabled ? projectId : null);
    const [milestones, setMilestones] = useState<{ of: number; rows: Milestone[] }>({
        of: projectId,
        rows: [],
    });

    useEffect(() => {
        if (!enabled) return;
        let live = true;
        void loadProjectMilestones(projectId, accessToken).then((res) => {
            if (live && res) setMilestones({ of: projectId, rows: res.milestones ?? [] });
        });
        return () => {
            live = false;
        };
    }, [enabled, projectId, accessToken]);

    return {
        ...data,
        projectId,
        current: data.projects.find((p) => p.projectId === projectId),
        statuses,
        fields,
        milestones: milestones.of === projectId ? milestones.rows : [],
        popupZ,
    };
};

/** The projects a rule of this one may name: joined, live and hosted by the same team. */
export const destinationProjects = (lookups: Lookups): ProjectProps[] =>
    lookups.projects.filter(
        (p) =>
            p.projectId !== lookups.projectId &&
            p.isJoined !== false &&
            !p.archived &&
            (p.hostTeamId ?? "") === (lookups.current?.hostTeamId ?? "")
    );

/** A private project's tasks may not move to a public one. */
export const refusedAsPublic = (lookups: Lookups, destination: ProjectProps): boolean =>
    lookups.current?.isPrivate === true && destination.isPrivate !== true;

type Row = Pick<ProjectStatusDef, "name" | "builtinKey" | "color" | "category">;
export type StatusOption = { key: string; pick: StatusPick; row: Row };

const builtinRow = (category: string): Row => ({
    name: category,
    builtinKey: category,
    color: "",
    category,
});

const isCategoryOwn = (row: ProjectStatusDef) => row.builtinKey === row.category;

export const statusKey = (pick: StatusPick): string =>
    pick.customStatusId != null ? `s:${pick.customStatusId}` : `c:${pick.category}`;

/**
 * What a "status" slot offers. A category's own built-in stands for the category itself; every
 * other row of the project stands for that status alone.
 */
export const statusOptions = (rows: ProjectStatusDef[]): StatusOption[] => {
    const live = sortStatuses(rows).filter((r) => !r.isArchived);
    const list: { pick: StatusPick; row: Row }[] = [];
    for (const category of STATUS_CATEGORIES) {
        const group = live.filter((r) => r.category === category);
        // A project that set nothing up lists the categories.
        if (!rows.length) {
            list.push({ pick: { category, customStatusId: null }, row: builtinRow(category) });
        }
        for (const row of group) {
            list.push({
                pick: { category, customStatusId: isCategoryOwn(row) ? null : row.statusId },
                row,
            });
        }
    }
    return list.map((o) => ({ ...o, key: statusKey(o.pick) }));
};

/** The row a saved pick reads as, whether or not the slot still offers it. */
export const statusRowOf = (pick: StatusPick, rows: ProjectStatusDef[]): Row | undefined => {
    if (pick.customStatusId != null) {
        return rows.find((r) => r.statusId === pick.customStatusId);
    }
    return (
        rows.find((r) => r.category === pick.category && isCategoryOwn(r)) ??
        (pick.category ? builtinRow(pick.category) : undefined)
    );
};
