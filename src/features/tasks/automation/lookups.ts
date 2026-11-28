/**
 * The names a rule's ids stand for: this project's people, tags, milestones, custom fields and
 * statuses, and the projects a rule may move into.
 */
import { createContext, useContext, useEffect, useState } from "react";

import { useAuth } from "../../../context/authState";
import { useProjectCustomFields } from "../../../hooks/tasks/useProjectCustomFields";
import { useProjectStatuses } from "../../../hooks/tasks/useProjectStatuses";
import type { UserProps } from "../../../types/admin";
import type { AllChatProps } from "../../../types/chat";
import type { ProjectCustomFieldDef, ProjectProps, ProjectStatusDef } from "../../../types/tasks";
import { loadProjectMilestones } from "../sprint-milestone/services/loadProjectMilestones";
import { loadProjectSprints } from "../sprint-milestone/services/loadProjectSprints";
import type { Milestone, Sprint } from "../sprint-milestone/types";
import type { StatusPick } from "./draft";

export type AutomationContextData = {
    /** The team's projects as the app lists them (`usePM.teamProjects`). */
    projects: ProjectProps[];
    members: UserProps[];
    myself: UserProps;
    /** For the member picker's avatars and names, as the task view has them. */
    profiles: Record<string, UserProps>;
    /** The project picker's project images. */
    chats: AllChatProps[];
};

export type Lookups = AutomationContextData & {
    projectId: number;
    current: ProjectProps | undefined;
    statuses: ProjectStatusDef[];
    fields: ProjectCustomFieldDef[];
    milestones: Milestone[];
    /** The milestone picker names each milestone's sprint. */
    sprints: Sprint[];
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
    const [sprints, setSprints] = useState<{ of: number; rows: Sprint[] }>({
        of: projectId,
        rows: [],
    });

    useEffect(() => {
        if (!enabled) return;
        let live = true;
        void loadProjectMilestones(projectId, accessToken).then((res) => {
            if (live && res) setMilestones({ of: projectId, rows: res.milestones ?? [] });
        });
        void loadProjectSprints(projectId, accessToken).then((res) => {
            if (live && res) setSprints({ of: projectId, rows: res.sprints ?? [] });
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
        sprints: sprints.of === projectId ? sprints.rows : [],
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

const builtinRow = (category: string): Row => ({
    name: category,
    builtinKey: category,
    color: "",
    category,
});

/** A category's own built-in stands for the category itself. */
const isCategoryOwn = (row: ProjectStatusDef) => row.builtinKey === row.category;

/**
 * What a pick in the status picker saves: every other row of the project stands for that
 * status alone. `statusId` is undefined in a project that set nothing up.
 */
export const statusPickOf = (
    category: string,
    statusId: number | null | undefined,
    rows: ProjectStatusDef[]
): StatusPick => {
    const row = rows.find((r) => r.statusId === statusId);
    return { category, customStatusId: row && !isCategoryOwn(row) ? row.statusId : null };
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
