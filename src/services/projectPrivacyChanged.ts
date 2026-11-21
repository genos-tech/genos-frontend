/** A project's Private/Hidden switches changed (MIP-1949).
 *
 *  `ModalProjectProfile` only holds its own copy of the profile. The sidebar (lock icon), the Join
 *  list and Spotlight read the shared project list, so the modal announces the change here and the
 *  app shell patches that list, instead of waiting for the next project-list refetch. */
export const PROJECT_PRIVACY_CHANGED_EVENT = "genos:project-privacy-changed";

export interface ProjectPrivacyChange {
    projectId: number;
    isPrivate: boolean;
    isHidden: boolean;
}

export const announceProjectPrivacyChanged = (change: ProjectPrivacyChange): void => {
    window.dispatchEvent(new CustomEvent(PROJECT_PRIVACY_CHANGED_EVENT, { detail: change }));
};

/** Returns `projects` with the changed project patched, or the same array when none matched. */
export const applyProjectPrivacyChange = <
    T extends { projectId: number; isPrivate?: boolean; isHidden?: boolean },
>(
    projects: T[],
    change: ProjectPrivacyChange
): T[] => {
    if (!projects.some((p) => Number(p.projectId) === Number(change.projectId))) return projects;
    return projects.map((p) =>
        Number(p.projectId) === Number(change.projectId)
            ? { ...p, isPrivate: change.isPrivate, isHidden: change.isHidden }
            : p
    );
};
