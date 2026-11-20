/**
 * MIP-1777: the small leaves the milestone panel (and the task panel) render now read the
 * locale: the "Saved" chip, the due / start date buttons ("TBD", "Clear") and the empty
 * comment list. Each is rendered in ja and ar, and in en where the English must not change.
 * The wording of ja / ar is a draft (TODO(copy): MIP-1777), so the assertions read the
 * catalog and pin what must not show.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskCommentList } from "../features/tasks/components/contents/base/sub/TaskCommentList";
import { TaskDueDateInput } from "../features/tasks/components/contents/base/sub/TaskDueDateInput";
import { TaskStartDateInput } from "../features/tasks/components/contents/base/sub/TaskStartDateInput";
import { TaskCustomBarBlock } from "../features/tasks/components/contents/base/TaskCustomBarBlock";
import { I18nProvider, loadLocale } from "../i18n";
import { en } from "../i18n/locales/en";

vi.mock("../features/tasks/services/loadTaskComments", () => ({
    loadTaskComments: vi.fn(async () => []),
}));

type L = "en" | "ja" | "ar";

const inLocale = async (locale: L, ui: React.ReactElement) => {
    await loadLocale(locale);
    window.localStorage.setItem("genos-locale", locale);
    return render(
        <CssVarsProvider>
            <I18nProvider>
                <MemoryRouter>{ui}</MemoryRouter>
            </I18nProvider>
        </CssVarsProvider>
    );
};

const task = { id: 1, title: "T", dueDate: null, startDate: null } as never;

beforeEach(() => window.localStorage.removeItem("genos-locale"));

describe("task / milestone panel leaves are not hard-coded English (MIP-1777)", () => {
    for (const locale of ["ja", "ar"] as const) {
        it(`${locale}: the Saved chip`, async () => {
            const c = await loadLocale(locale);
            await inLocale(locale, <TaskCustomBarBlock taskBodySaved />);
            expect(screen.getByText(c.notes.editor.savedChip)).toBeInTheDocument();
            expect(screen.queryByText("Saved")).toBeNull();
        });

        it(`${locale}: the due date TBD button and the start date Clear button`, async () => {
            const c = await loadLocale(locale);
            await inLocale(
                locale,
                <>
                    <TaskDueDateInput setTaskContent={vi.fn()} taskContent={task} />
                    <TaskStartDateInput setTaskContent={vi.fn()} taskContent={task} />
                </>
            );
            expect(
                screen.getByRole("button", { name: c.tasks.preview.dueDateTbd })
            ).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: c.common.actions.clear })
            ).toBeInTheDocument();
            expect(screen.queryByText("TBD")).toBeNull();
            expect(screen.queryByText("Clear")).toBeNull();
        });

        it(`${locale}: the empty comment list`, async () => {
            const c = await loadLocale(locale);
            await inLocale(
                locale,
                <TaskCommentList
                    currentProjectId={3}
                    currentProjectName="Proj"
                    currentTaskDisplayId="PRJ-1"
                    myself={{ userId: "u1" } as never}
                    setEditTargetComment={vi.fn()}
                    setIsInEdit={vi.fn()}
                    setMyself={vi.fn()}
                    socket={null}
                    taskComments={[]}
                    useCM={{} as never}
                    useTEM={{} as never}
                    useTM={{} as never}
                    useUISM={{} as never}
                />
            );
            expect(screen.getByText(c.tasks.tabs.noComments)).toBeInTheDocument();
            expect(screen.queryByText("No comments yet")).toBeNull();
        });
    }

    it("en is unchanged", async () => {
        await inLocale(
            "en",
            <>
                <TaskCustomBarBlock taskBodySaved />
                <TaskDueDateInput setTaskContent={vi.fn()} taskContent={task} />
                <TaskStartDateInput setTaskContent={vi.fn()} taskContent={task} />
            </>
        );
        expect(screen.getByText("Saved")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "TBD" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
        expect(en.tasks.tabs.noComments).toBe("No comments yet");
        expect(en.tasks.tabs.dropFilesHere).toBe("Drag & Drop files here");
        expect(en.tasks.tabs.dropFilesBrowse).toBe("or use the button below to browse");
    });
});
