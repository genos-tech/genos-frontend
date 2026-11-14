/**
 * The approval card for deleting a file on a task (MIP-1563, genos-api AGENT_PARITY_TOOLS).
 *
 * The model names the file by two numbers; the backend adds `current: {name, size_bytes, type}` for
 * a file on a task the approver can open. The card says WHICH file, how big, and (through the card's
 * own chip, from `undoable: false` + `undo_reason: irreversible_delete`) that this cannot be undone.
 * It prints everything as text: no link to the file, and the file's name is never made a link.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getToolLabel } from "../features/agentQA";
import { getApprovalRenderer } from "../features/agentQA/approval/approvalRenderers";
import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import { fmt } from "../i18n";
import type { PendingApprovalPayload } from "../services/agentApi";

const mount = (args: Record<string, unknown>, over: Partial<PendingApprovalPayload> = {}) => {
    const pending: PendingApprovalPayload = {
        step: 1,
        tool_name: "delete_task_attachment",
        arguments: args,
        approval_token: "tok",
        run_id: "run",
        ...over,
    };
    return render(
        <CssVarsProvider>
            <ApprovalCard
                approveLabel="Approve"
                pending={pending}
                rejectLabel="Reject"
                titleText="Approval required"
                onApprove={vi.fn()}
                onReject={vi.fn()}
            />
        </CssVarsProvider>
    );
};

const IRREVERSIBLE = { undoable: false, undo_reason: "irreversible_delete" } as const;

afterEach(cleanup);

describe("the delete_task_attachment card", () => {
    it("has a structured preview of its own", () => {
        expect(getApprovalRenderer("delete_task_attachment")).toBeDefined();
    });

    it("names the file and the task, with its size and type", () => {
        mount(
            {
                task_id: "WRD-5",
                attachment_id: 2,
                current: {
                    name: "budget.xlsx",
                    size_bytes: 2048,
                    type: "application/vnd.ms-excel",
                },
            },
            IRREVERSIBLE
        );
        expect(screen.getByText("Delete file budget.xlsx from WRD-5")).toBeTruthy();
        expect(screen.getByText("2.0 KB")).toBeTruthy();
        expect(screen.getByText("application/vnd.ms-excel")).toBeTruthy();
        // Structured: the raw key:value fallback must NOT render.
        expect(screen.queryByText("attachment_id:")).toBeNull();
        expect(screen.queryByText("task_id:")).toBeNull();
    });

    it("says it can't be undone, once, from the card's own chip", () => {
        mount(
            {
                task_id: "WRD-5",
                attachment_id: 2,
                current: { name: "budget.xlsx", size_bytes: 10 },
            },
            IRREVERSIBLE
        );
        const chip = screen.getByTestId("undo-chip");
        expect(within(chip).getByText("Can't be undone")).toBeTruthy();
        expect(within(chip).getByText("This deletes it for good.")).toBeTruthy();
        // The preview's own chip stays out when the backend has spoken.
        expect(screen.queryByText("This action cannot be undone")).toBeNull();
    });

    it("says it itself when the backend sent no prediction", () => {
        mount({ task_id: "WRD-5", attachment_id: 2, current: { name: "budget.xlsx" } });
        expect(screen.queryByTestId("undo-chip")).toBeNull();
        expect(screen.getByText("This action cannot be undone")).toBeTruthy();
    });

    it("shows only the numbers for a file the backend could not name", () => {
        mount({ task_id: "WRD-5", attachment_id: 7 }, IRREVERSIBLE);
        expect(screen.getByText("Delete file #7 from WRD-5")).toBeTruthy();
        expect(screen.queryByText(/KB|MB| B$/)).toBeNull();
    });

    it("leaves out a size or type that is missing, empty or not a number", () => {
        mount(
            {
                task_id: "WRD-5",
                attachment_id: 1,
                current: { name: "notes.txt", size_bytes: null, type: "  " },
            },
            IRREVERSIBLE
        );
        expect(screen.getByText("Delete file notes.txt from WRD-5")).toBeTruthy();
        expect(screen.queryByText("null")).toBeNull();
        expect(screen.queryByText("NaN B")).toBeNull();
    });

    it("prints a zero-byte file as 0 B", () => {
        mount(
            { task_id: "WRD-5", attachment_id: 1, current: { name: "empty.txt", size_bytes: 0 } },
            IRREVERSIBLE
        );
        expect(screen.getByText("0 B")).toBeTruthy();
    });

    it("prints a file name as text, never as a link or markup", () => {
        const name = "<img src=x onerror=alert(1)>.txt";
        const { container } = mount(
            { task_id: "WRD-5", attachment_id: 1, current: { name } },
            IRREVERSIBLE
        );
        expect(screen.getByText(`Delete file ${name} from WRD-5`)).toBeTruthy();
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("a")).toBeNull();
    });

    it("lets a long name wrap instead of pushing the card wide", () => {
        const name = `${"a".repeat(300)}.pdf`;
        mount({ task_id: "WRD-5", attachment_id: 1, current: { name } }, IRREVERSIBLE);
        const heading = screen.getByText(`Delete file ${name} from WRD-5`);
        expect(getComputedStyle(heading).overflowWrap).toBe("anywhere");
    });

    it("has an Approve and a Reject button like every card", () => {
        mount({ task_id: "WRD-5", attachment_id: 2 }, IRREVERSIBLE);
        expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
    });
});

describe("the heading in every language", () => {
    // The RAW catalogs: `getMessages` falls back to English for a key a locale lacks, which would
    // hide a missing translation (the coverage test holds the same line for the whole catalog).
    const CODES = ["en", "ja", "zh", "es", "fr", "hi", "ar"] as const;
    const load = async (code: string) =>
        (await import(`../i18n/locales/${code}`))[code] as typeof import("../i18n/locales/en").en;

    it.each(CODES)(
        "%s says the file and the task, and its progress label is not the raw name",
        async (code) => {
            const t = await load(code);
            const heading = fmt(t.agentApproval.deleteTaskAttachment, {
                file: "FILE.xlsx",
                task: "WRD-5",
            });
            expect(heading).toContain("FILE.xlsx");
            expect(heading).toContain("WRD-5");
            const unnamed = fmt(t.agentApproval.deleteTaskAttachmentUnnamed, {
                id: 7,
                task: "WRD-5",
            });
            expect(unnamed).toContain("7");
            expect(unnamed).toContain("WRD-5");
            const label = getToolLabel("delete_task_attachment", t);
            expect(label).not.toBe("delete_task_attachment");
            expect(label.trim().length).toBeGreaterThan(3);
            if (code !== "en") {
                const english = getToolLabel("delete_task_attachment", await load("en"));
                expect(label).not.toBe(english);
                expect(heading).not.toBe(
                    fmt((await load("en")).agentApproval.deleteTaskAttachment, {
                        file: "FILE.xlsx",
                        task: "WRD-5",
                    })
                );
            }
        }
    );
});
