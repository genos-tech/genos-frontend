// The departments typed on the create-team form (MIP-1691). The server is the authority
// (genos-api `team_setup.parse_departments`); this only mirrors its limits so the person hears
// about a problem before sending.

export const MAX_DEPARTMENTS = 20;
export const MAX_DEPARTMENT_NAME_LENGTH = 30;

/**
 * The names in the box: one per line or separated by commas (`,`, `、`, `，`), trimmed, blanks
 * dropped, and a name already given (any case) dropped.
 */
export const parseDepartments = (text: string): string[] => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const part of text.split(/[\n,、，]/)) {
        const name = part.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(name);
    }
    return names;
};

export type DepartmentsProblem = "tooMany" | "tooLong" | null;

export const departmentsProblem = (names: string[]): DepartmentsProblem => {
    if (names.length > MAX_DEPARTMENTS) return "tooMany";
    if (names.some((name) => name.length > MAX_DEPARTMENT_NAME_LENGTH)) return "tooLong";
    return null;
};
