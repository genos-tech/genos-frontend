/**
 * MIP-1809: the TASK header's "Start Task" / "Complete Task" buttons and the create-task form's
 * attachment drop zone ("Drag & Drop files here" / "or use the button below to browse") read the
 * locale. They were literal JSX text, so every locale showed English.
 *
 * The REAL `TaskTitleBlock` and `TaskCreateAttachmentBlock` are mounted under the real
 * `I18nProvider`. The wording of ja / zh / es / fr / hi / ar is a draft (TODO(copy): MIP-1809), so
 * the mounted assertions read the catalog and pin what must NOT show: the English. A separate
 * check reads the RAW catalogs (a locale that falls back to English would pass the merged one).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskCreateAttachmentBlock } from "../features/tasks/components/contents/base/TaskCreateAttachmentBlock";
import { TaskTitleBlock } from "../features/tasks/components/contents/base/TaskTitleBlock";
import { I18nProvider, loadLocale } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "t" }),
    useOptionalAccessToken: () => "t",
}));
vi.mock("../services/notifications/notificationsContextState", () => ({
    useNotificationsContext: () => ({
        isTargetMutedByKey: () => false,
        muteTarget: vi.fn(),
        unmuteTarget: vi.fn(),
    }),
}));
vi.mock("../features/tasks/hooks/useConvertTaskMilestone", () => ({
    useConvertTaskMilestone: () => ({ toMilestone: vi.fn(), toTask: vi.fn() }),
}));
vi.mock("../features/tasks/diagram/components/LazyTaskDiagram", () => ({
    LazyTaskDiagram: () => <div />,
}));

type L = "en" | "ja" | "ar";

beforeEach(() => window.localStorage.removeItem("genos-locale"));
afterEach(cleanup);

const inLocale = async (locale: L, ui: React.ReactElement) => {
    await loadLocale(locale);
    window.localStorage.setItem("genos-locale", locale);
    return render(
        <CssVarsProvider>
            <I18nProvider>
                <MemoryRouter initialEntries={["/workspace/tasks"]}>{ui}</MemoryRouter>
            </I18nProvider>
        </CssVarsProvider>
    );
};

const titleBlock = (status: string) => (
    <TaskTitleBlock
        isPreviewMode={true}
        myself={{ userId: "u1", teamId: "t1" } as never}
        setTaskTitle={vi.fn()}
        taskTitle="Launch plan"
        useCM={{} as never}
        useNM={{ taskNoteMeta: [] } as never}
        usePM={{} as never}
        useSM={{ applyMilestoneToState: vi.fn(), forgetMilestone: vi.fn() } as never}
        useTM={{ isCreatingTask: { flag: false } } as never}
        useUISM={{} as never}
        taskContent={
            {
                id: 42,
                rootTaskId: 42,
                title: "Launch plan",
                parentTaskId: null,
                milestoneId: null,
                project: { projectId: 7 },
                status: { status },
            } as never
        }
    />
);

const dropZone = (
    <TaskCreateAttachmentBlock
        setTaskContent={vi.fn()}
        taskContent={{ id: 0, attachments: [] } as never}
    />
);

describe("the task header's Start / Complete buttons", () => {
    it("en is exactly the old literals", async () => {
        await inLocale("en", titleBlock("Open"));
        expect(screen.getByRole("button", { name: "Start Task" })).toBeInTheDocument();
        cleanup();
        await inLocale("en", titleBlock("WIP"));
        expect(screen.getByRole("button", { name: "Complete Task" })).toBeInTheDocument();
    });

    for (const locale of ["ja", "ar"] as const) {
        it(`${locale}: Start Task on an Open and a Pending task`, async () => {
            const c = await loadLocale(locale);
            for (const status of ["Open", "Pending"]) {
                await inLocale(locale, titleBlock(status));
                expect(
                    screen.getByRole("button", { name: c.tasks.preview.startTask })
                ).toBeInTheDocument();
                expect(screen.queryByText("Start Task")).toBeNull();
                cleanup();
            }
        });

        it(`${locale}: Complete Task on a WIP task`, async () => {
            const c = await loadLocale(locale);
            await inLocale(locale, titleBlock("WIP"));
            expect(
                screen.getByRole("button", { name: c.tasks.preview.completeTask })
            ).toBeInTheDocument();
            expect(screen.queryByText("Complete Task")).toBeNull();
        });
    }
});

describe("the create form's drop zone", () => {
    it("en is exactly the old literals", async () => {
        await inLocale("en", dropZone);
        expect(screen.getByText("Drag & Drop files here")).toBeInTheDocument();
        expect(screen.getByText("or use the button below to browse")).toBeInTheDocument();
    });

    for (const locale of ["ja", "ar"] as const) {
        it(`${locale}: both lines come from the catalog`, async () => {
            const c = await loadLocale(locale);
            await inLocale(locale, dropZone);
            expect(screen.getByText(c.tasks.tabs.dropFilesHere)).toBeInTheDocument();
            expect(screen.getByText(c.tasks.tabs.dropFilesBrowse)).toBeInTheDocument();
            expect(screen.queryByText("Drag & Drop files here")).toBeNull();
            expect(screen.queryByText("or use the button below to browse")).toBeNull();
        });
    }
});

describe("the words exist in every locale (raw catalogs, no fallback to English)", () => {
    const locales = { ja, zh, es, fr, hi, ar } as const;
    for (const [name, cat] of Object.entries(locales)) {
        it(`${name}: startTask / completeTask / dropFilesHere / dropFilesBrowse are translated`, () => {
            const p = (cat as typeof en).tasks.preview;
            const tabs = (cat as typeof en).tasks.tabs;
            expect(p.startTask).toBeTruthy();
            expect(p.completeTask).toBeTruthy();
            expect(p.startTask).not.toBe(en.tasks.preview.startTask);
            expect(p.completeTask).not.toBe(en.tasks.preview.completeTask);
            expect(p.startTask).not.toBe(p.completeTask);
            expect(tabs.dropFilesHere).not.toBe(en.tasks.tabs.dropFilesHere);
            expect(tabs.dropFilesBrowse).not.toBe(en.tasks.tabs.dropFilesBrowse);
        });
    }
});
