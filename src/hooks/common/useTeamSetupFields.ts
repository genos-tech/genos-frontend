import { useMemo, useState } from "react";

import {
    departmentsProblem,
    parseDepartments,
    type DepartmentsProblem,
} from "../../features/admin/utils/departments";

/**
 * The two optional choices a new team is created with (MIP-1691, MIP-1709): the sample data and
 * the departments. The first-run page and the in-app "Create New Team" modal both own one of
 * these, so the default and the validation are the same on both and cannot drift.
 */
export type TeamSetupFieldsState = {
    /** Default ON: a new team benefits from landing in a populated app. */
    withStarter: boolean;
    setWithStarter: (value: boolean) => void;
    departmentsText: string;
    setDepartmentsText: (value: string) => void;
    /** The names typed, parsed (one per line or comma-separated, no blanks, no repeats). */
    departments: string[];
    /** Why the server would refuse the list, or null. The form blocks sending until it is null. */
    problem: DepartmentsProblem;
};

export const useTeamSetupFields = (): TeamSetupFieldsState => {
    const [withStarter, setWithStarter] = useState(true);
    const [departmentsText, setDepartmentsText] = useState("");
    const departments = useMemo(() => parseDepartments(departmentsText), [departmentsText]);
    const problem = departmentsProblem(departments);
    return {
        withStarter,
        setWithStarter,
        departmentsText,
        setDepartmentsText,
        departments,
        problem,
    };
};
