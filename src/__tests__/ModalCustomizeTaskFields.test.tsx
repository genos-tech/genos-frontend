// Wiring test for the owner-only "Customize Task Fields" modal: renders
// one row per configurable field, locks Project, disables tags-required
// when the project has no tags, and saves the pruned rules blob via the
// service before writing the response back into useTM.taskFieldRules.

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalCustomizeTaskFields } from "../features/tasks/components/modals/ModalCustomizeTaskFields";
import { loadProjectTags } from "../features/tasks/services/loadProjectTags";
import { saveProjectTaskFieldRules } from "../features/tasks/services/projectTaskFieldRules";
import { ProjectManagementState } from "../hooks/common/useProjectManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import { UserProps } from "../types/admin";

vi.mock("../features/tasks/services/loadProjectTags", () => ({
    loadProjectTags: vi.fn(),
}));
vi.mock("../features/tasks/services/projectTaskFieldRules", () => ({
    saveProjectTaskFieldRules: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const loadProjectTagsMock = vi.mocked(loadProjectTags);
const saveRulesMock = vi.mocked(saveProjectTaskFieldRules);

const myself = { userId: "u1", teamId: "t1" } as UserProps;
const debugTag = { tagName: "debug", tagColor: "#111111", tagTextColor: "#ffffff" };

const makeTM = (overrides: Partial<TaskManagementState> = {}) =>
    ({
        taskFieldRules: { projectId: 7, ownerUserId: "u1", rules: {} },
        setTaskFieldRules: vi.fn(),
        ...overrides,
    }) as unknown as TaskManagementState;

const renderModal = (useTM: TaskManagementState, onClose = vi.fn()) => {
    render(
        <CssVarsProvider>
            <ModalCustomizeTaskFields
                myself={myself}
                open={true}
                usePM={{ currentProject: { projectId: 7 } } as unknown as ProjectManagementState}
                useTM={useTM}
                useTEM={
                    {
                        teamMembers: [
                            { userId: "u1", userName: "Me" },
                            { userId: "u2", userName: "Ally" },
                        ],
                    } as unknown as TeamManagementState
                }
                onClose={onClose}
            />
        </CssVarsProvider>
    );
    return { onClose };
};

describe("ModalCustomizeTaskFields", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loadProjectTagsMock.mockResolvedValue([debugTag]);
    });

    it("renders one row per field in order, with Project and Status locked", async () => {
        renderModal(makeTM());

        // Product order: Project, Reporter, Assignee, Due Date, Tags,
        // Effort Level, Priority, Status.
        const order = [
            "Project",
            "Reporter",
            "Assignee",
            "Due Date",
            "Tags",
            "Effort Level",
            "Priority",
            "Status",
        ];
        const nodes = order.map((label) => screen.getByText(label));
        nodes.forEach((node) => expect(node).toBeInTheDocument());
        // Assert actual DOM order, not just presence: each label must
        // precede the next in document order.
        for (let i = 0; i < nodes.length - 1; i++) {
            expect(
                nodes[i].compareDocumentPosition(nodes[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy();
        }

        // Project + Status are locked (no switch): each shows a muted
        // auto marker.
        expect(screen.getByText("Always required")).toBeInTheDocument();
        expect(screen.getByText("Set automatically at creation")).toBeInTheDocument();
        // 6 Required switches: reporter/assignee/dueDate/tags/effortLevel/
        // priority (project + status locked).
        await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(6));
    });

    it("disables the tags Required switch while the project has no tags", async () => {
        loadProjectTagsMock.mockResolvedValue([]);
        renderModal(makeTM());

        await waitFor(() => {
            const switches = screen.getAllByRole("switch");
            expect(switches.filter((el) => (el as HTMLInputElement).disabled)).toHaveLength(1);
        });
    });

    it("saves the pruned blob and writes the response back into useTM", async () => {
        const saved = {
            projectId: 7,
            ownerUserId: "u1",
            rules: { priority: { required: true } },
        };
        saveRulesMock.mockResolvedValue(saved);
        const useTM = makeTM({
            // A stored no-op entry (required false, no default) must be
            // pruned out of the PUT payload.
            taskFieldRules: {
                projectId: 7,
                ownerUserId: "u1",
                rules: {
                    priority: { required: true },
                    effortLevel: { required: false, default: null },
                },
            },
        } as Partial<TaskManagementState>);
        const onClose = vi.fn();
        renderModal(useTM, onClose);

        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(saveRulesMock).toHaveBeenCalledTimes(1));
        expect(saveRulesMock).toHaveBeenCalledWith(7, { priority: { required: true } }, "tok");
        await waitFor(() => expect(useTM.setTaskFieldRules).toHaveBeenCalledWith(saved));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("surfaces a save failure inline and keeps the modal open", async () => {
        saveRulesMock.mockResolvedValue(null);
        const useTM = makeTM();
        const onClose = vi.fn();
        renderModal(useTM, onClose);

        fireEvent.click(screen.getByText("Save"));

        await waitFor(() =>
            expect(
                screen.getByText(
                    "Couldn't save — only the project owner can change these settings."
                )
            ).toBeInTheDocument()
        );
        expect(useTM.setTaskFieldRules).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });
});
