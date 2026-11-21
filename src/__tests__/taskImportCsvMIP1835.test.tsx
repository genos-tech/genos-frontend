/**
 * MIP-1835: the CSV task import dialog and its strings.
 *
 * The locale half reads the raw catalogs (the loader would merge English over a gap) and checks
 * every key, placeholder and translation of `tasks.importCsv` in all seven locales. The dialog
 * half drives the real component with a stubbed API: file, columns, preview, import, result, undo.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalImportTasksCsv } from "../features/tasks/components/modals/ModalImportTasksCsv";
import { I18nProvider, loadLocale } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

const api = vi.hoisted(() => ({
    previewTaskImport: vi.fn(),
    commitTaskImport: vi.fn(),
    previewUndoTaskImport: vi.fn(),
    undoTaskImport: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
}));
vi.mock("../features/tasks/services/taskImportApi", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../features/tasks/services/taskImportApi")>();
    return { ...actual, ...api };
});

const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;

type Tree = { [key: string]: Tree | string };
const leaves = (node: unknown, trail: string[] = []): Array<[string, string]> => {
    if (typeof node === "string") return [[trail.join("."), node]];
    if (node === null || typeof node !== "object") return [];
    return Object.entries(node as Tree).flatMap(([k, v]) => leaves(v, [...trail, k]));
};
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
const enLeaves = leaves(en.tasks.importCsv, ["importCsv"]);

describe("tasks.importCsv has every string in every locale", () => {
    it("has a catalog worth testing, marked as a draft", () => {
        expect(enLeaves.length).toBeGreaterThan(80);
        expect(enLeaves.every(([, text]) => text.trim() !== "")).toBe(true);
    });

    it.each(NAMES)("%s defines every key English has, and none it doesn't", (name) => {
        const own = leaves(OTHERS[name].tasks?.importCsv, ["importCsv"]).map(([p]) => p);
        const wanted = enLeaves.map(([p]) => p);
        expect({ name, missing: wanted.filter((p) => !own.includes(p)) }).toEqual({
            name,
            missing: [],
        });
        expect({ name, extra: own.filter((p) => !wanted.includes(p)) }).toEqual({
            name,
            extra: [],
        });
    });

    it.each(NAMES)("%s keeps every {placeholder} and is not pasted English", (name) => {
        const own = Object.fromEntries(leaves(OTHERS[name].tasks?.importCsv, ["importCsv"]));
        const broken = enLeaves
            .filter(([p, text]) => placeholders(own[p] ?? "").join() !== placeholders(text).join())
            .map(([p]) => p);
        const pasted = enLeaves
            .filter(([p, text]) => text.length > 12 && own[p] === text)
            .map(([p]) => p);
        expect({ name, broken, pasted }).toEqual({ name, broken: [], pasted: [] });
    });
});

const PREVIEW = {
    profile: "jira",
    headers: ["Summary", "Issue key", "Status", "Priority", "Assignee"],
    mapping: { title: [0], external_id: [1], status: [2], priority: [3], assignee: [4] },
    counts: { rows: 2, errors: 1, warnings: 1, already_imported: 0, to_create: 1 },
    new_tags: ["infra"],
    status_values: [{ value: "To Do", count: 2, mapped: "Open" }],
    priority_values: [{ value: "High", count: 1, mapped: "High" }],
    limits: { max_rows: 1000 },
    rows: [
        {
            row: 2,
            title: "Set up the pipeline",
            status: "Open",
            priority: "High",
            due_date: null,
            assignee_email: "",
            tags: ["infra"],
            parent_row: null,
            errors: [],
            warnings: [{ code: "assignee_unknown", value: "x@y.test" }],
            already_imported: false,
        },
        {
            row: 3,
            title: "",
            status: "Open",
            priority: null,
            due_date: null,
            assignee_email: "",
            tags: [],
            parent_row: null,
            errors: [{ code: "title_missing" }],
            warnings: [],
            already_imported: false,
        },
    ],
};

beforeAll(async () => {
    await loadLocale("en");
});
beforeEach(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    api.previewTaskImport.mockResolvedValue(PREVIEW);
    api.commitTaskImport.mockResolvedValue({
        run_id: "run-1",
        created: 1,
        skipped: 0,
        failed: 1,
        report: [
            { row: 2, outcome: "created", display_id: "IMP-1" },
            { row: 3, outcome: "failed", code: "title_missing" },
        ],
    });
    api.previewUndoTaskImport.mockResolvedValue({ will_remove: 1, kept: 0 });
    api.undoTaskImport.mockResolvedValue({ removed: 1, kept: 0 });
});
afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
});

const renderModal = (onChanged = vi.fn()) =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <ModalImportTasksCsv projectId={7} open onChanged={onChanged} onClose={vi.fn()} />
            </I18nProvider>
        </CssVarsProvider>
    );

const chooseFile = async () => {
    const input = screen.getByTestId("import-tasks-file") as HTMLInputElement;
    const file = new File(["Summary\nx"], "jira.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText("Jira export detected");
    return file;
};

describe("the import dialog", () => {
    it("walks file, columns, preview, import and result, and creates only on Import", async () => {
        const onChanged = vi.fn();
        renderModal(onChanged);
        const file = await chooseFile();
        expect(api.previewTaskImport).toHaveBeenCalledWith("tok", { projectId: 7, file });
        expect(api.commitTaskImport).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        await screen.findByTestId("import-summary");
        expect(screen.getByTestId("import-summary").textContent).toBe(
            "1 to create · 0 already imported · 1 with errors"
        );
        expect(screen.getByTestId("import-row-3").textContent).toContain("No title");
        expect(screen.getByTestId("import-row-2").textContent).toContain(
            "No Genos user has the e-mail x@y.test"
        );
        expect(api.commitTaskImport).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Import 1 tasks" }));
        await screen.findByTestId("import-result");
        expect(screen.getByTestId("import-result").textContent).toBe(
            "1 created · 0 skipped · 1 failed"
        );
        expect(screen.getByText("Row 3: No title")).toBeTruthy();
        expect(api.commitTaskImport.mock.calls[0][1]).toMatchObject({
            projectId: 7,
            createTags: true,
            mapping: PREVIEW.mapping,
        });
        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("asks before undoing and reports what it removed", async () => {
        const onChanged = vi.fn();
        renderModal(onChanged);
        await chooseFile();
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        await screen.findByTestId("import-summary");
        fireEvent.click(screen.getByRole("button", { name: "Import 1 tasks" }));
        await screen.findByTestId("import-result");

        fireEvent.click(screen.getByRole("button", { name: "Undo this import" }));
        await screen.findByText("Remove 1 tasks? 0 you changed stay.");
        expect(api.undoTaskImport).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Remove 1 tasks" }));
        await screen.findByTestId("import-undone");
        expect(api.undoTaskImport).toHaveBeenCalledWith("tok", "run-1");
        expect(onChanged).toHaveBeenCalledTimes(2);
    });

    it("words a refusal from the server and stays on the file step", async () => {
        const { TaskImportError } = await import("../features/tasks/services/taskImportApi");
        api.previewTaskImport.mockRejectedValueOnce(new TaskImportError("too_many_rows", 1000));
        renderModal();
        const input = screen.getByTestId("import-tasks-file") as HTMLInputElement;
        fireEvent.change(input, { target: { files: [new File(["a"], "big.csv")] } });
        await waitFor(() =>
            expect(screen.getByRole("alert").textContent).toContain("more than 1000 rows")
        );
        expect(screen.queryByText("Jira export detected")).toBeNull();
    });

    it("will not go past the columns step without a title column", async () => {
        api.previewTaskImport.mockResolvedValueOnce({ ...PREVIEW, mapping: {} });
        renderModal();
        await chooseFile();
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        expect((await screen.findByRole("alert")).textContent).toContain("holds the task title");
        expect(api.previewTaskImport).toHaveBeenCalledTimes(1);
    });
});
