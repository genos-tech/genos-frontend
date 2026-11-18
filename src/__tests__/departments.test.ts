import { describe, expect, it } from "vitest";

import {
    departmentsProblem,
    MAX_DEPARTMENT_NAME_LENGTH,
    MAX_DEPARTMENTS,
    parseDepartments,
} from "../features/admin/utils/departments";

describe("parseDepartments (MIP-1691)", () => {
    it("splits on new lines and on commas of any width", () => {
        expect(parseDepartments("Payments, Billing\nGrowth、Sales，Support")).toEqual([
            "Payments",
            "Billing",
            "Growth",
            "Sales",
            "Support",
        ]);
    });

    it("trims, drops blanks and drops a name already given in any case", () => {
        expect(parseDepartments("  Payments ,, \n\nBilling,payments, BILLING ")).toEqual([
            "Payments",
            "Billing",
        ]);
    });

    it("an empty box is no departments", () => {
        expect(parseDepartments("")).toEqual([]);
        expect(parseDepartments(" \n , ")).toEqual([]);
    });

    it("keeps a name with spaces and letters of any language whole", () => {
        expect(parseDepartments("Customer Support\n営業")).toEqual(["Customer Support", "営業"]);
    });
});

describe("departmentsProblem (MIP-1691)", () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `Dept ${i}`);

    it("twenty is the most; twenty-one is too many", () => {
        expect(departmentsProblem(names(MAX_DEPARTMENTS))).toBeNull();
        expect(departmentsProblem(names(MAX_DEPARTMENTS + 1))).toBe("tooMany");
    });

    it("thirty characters is the longest name; thirty-one is too long", () => {
        expect(departmentsProblem(["x".repeat(MAX_DEPARTMENT_NAME_LENGTH)])).toBeNull();
        expect(departmentsProblem(["x".repeat(MAX_DEPARTMENT_NAME_LENGTH + 1)])).toBe("tooLong");
    });

    it("no names is no problem", () => {
        expect(departmentsProblem([])).toBeNull();
    });
});
