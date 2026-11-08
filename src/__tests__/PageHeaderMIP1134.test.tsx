/**
 * MIP-1134: one top bar for every main surface.
 *
 * `PageHeader` is the bar (title, optional subtitle, optional middle, optional
 * actions, one height, a hairline under it, flat). Inbox and Tasks render it;
 * the chat pane's channel header keeps its content and wears the same frame
 * (`pageHeaderFrameSx`), because wrapping it in a second bar would stack two.
 *
 * jsdom cannot measure layout, so heights are pinned as the CSS the component
 * emits; the measured heights per page are in `design/evidence/MIP-1134.md`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { PageHeader } from "../components/ui/page/PageHeader";
import { PAGE_HEADER_HEIGHT } from "../components/ui/page/pageHeaderFrame";
import { InboxHeader } from "../features/inbox/components/InboxHeader";
import { TaskHeader } from "../features/tasks/components/header/TaskHeader";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/tasks/components/sidebar/SearchBox", () => ({
    TaskSidebarSearchBox: () => <input aria-label="Search tasks" />,
}));

afterEach(cleanup);

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const code = (rel: string) =>
    readFileSync(join(SRC, rel), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

const wrap = (ui: React.ReactElement) =>
    render(
        <MemoryRouter>
            <CssVarsProvider>{ui}</CssVarsProvider>
        </MemoryRouter>
    );

describe("PageHeader", () => {
    it("is a header with the page's h1, and the slots in order: leading, title, middle, actions", () => {
        wrap(
            <PageHeader
                actions={<button>act</button>}
                leading={<i data-testid="lead" />}
                subtitle="sub"
                title="Title"
            >
                <input aria-label="mid" />
            </PageHeader>
        );
        const bar = document.querySelector("[data-page-header]") as HTMLElement;
        expect(bar.tagName).toBe("HEADER");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Title");
        const order = [
            screen.getByTestId("lead"),
            screen.getByRole("heading"),
            screen.getByLabelText("mid"),
            screen.getByRole("button", { name: "act" }),
        ];
        for (let i = 0; i < order.length - 1; i++) {
            expect(
                order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy();
        }
    });

    it("renders only the slots it is given", () => {
        wrap(<PageHeader title="Only" />);
        const bar = document.querySelector("[data-page-header]") as HTMLElement;
        expect(bar.textContent).toBe("Only");
        expect(bar.querySelectorAll("button, input")).toHaveLength(0);
    });

    it("one height (56 on a phone, 64 from md), a hairline under it, the page background", () => {
        wrap(<PageHeader title="T" />);
        const css = cssOf(document.querySelector("[data-page-header]") as HTMLElement);
        expect(PAGE_HEADER_HEIGHT).toEqual({ xs: 56, md: 64 });
        expect(css).toMatch(/min-height:\s*56px/);
        expect(css).toMatch(/min-height:\s*64px/);
        expect(css).toContain("var(--g-border-subtle)");
        expect(css).toContain("var(--g-bg)");
    });

    it("is flat: no gradient, shadow or blur; actions sit at the inline end so they mirror in RTL", () => {
        wrap(<PageHeader actions={<button>act</button>} title="T" />);
        const bar = document.querySelector("[data-page-header]") as HTMLElement;
        const css = cssOf(bar).toLowerCase();
        expect(css).not.toContain("gradient");
        expect(css).not.toContain("box-shadow");
        expect(css).not.toContain("backdrop-filter");
        const actions = screen.getByRole("button", { name: "act" }).parentElement as HTMLElement;
        expect(cssOf(actions)).toMatch(/margin-inline-start:\s*auto/);
        // Padding and margin are symmetric (`px`), so only an asymmetric physical rule would
        // break the mirror: no `text-align: left|right` and no `left:` / `right:` offset.
        expect(css).not.toMatch(/text-align:\s*(left|right)|(^|[;{\s])(left|right):/);
    });

    it("a long title truncates with an ellipsis: the h1 is a block, not a flex box (text-overflow does not apply inside one)", () => {
        wrap(<PageHeader title="A very long title" />);
        const css = cssOf(screen.getByRole("heading", { level: 1 }));
        expect(css).toMatch(/text-overflow:\s*ellipsis/);
        expect(css).toMatch(/overflow:\s*hidden/);
        expect(css).not.toMatch(/display:\s*flex/);
    });

    it("an empty slot renders nothing: 0, an empty string and false are not content", () => {
        wrap(<PageHeader actions={false} leading="" subtitle={0 as never} title="T" />);
        const bar = document.querySelector("[data-page-header]") as HTMLElement;
        expect(bar.textContent).toBe("T");
        // Only the title's own box is in the row: no leading, middle or actions wrapper.
        const row = bar.querySelector("[data-page-header-row]") as HTMLElement;
        expect(row.children).toHaveLength(1);
    });

    it("in a narrow bar the middle slot drops under the title row instead of being squeezed (a container query on the bar's own width)", () => {
        wrap(
            <PageHeader actions={<button>act</button>} title="T">
                <input aria-label="mid" />
            </PageHeader>
        );
        const bar = document.querySelector("[data-page-header]") as HTMLElement;
        // jsdom's CSSOM drops `@container` rules, so read the raw text Emotion inserted.
        const cls = [...bar.classList].find((c) => c.startsWith("css-"))!;
        const css = [...document.querySelectorAll("style")]
            .map((st) => st.textContent ?? "")
            .join("\n")
            .split("\n")
            .filter((line) => line.includes(cls))
            .join("\n");
        expect(css).toMatch(/container-type:\s*inline-size/);
        expect(css).toMatch(/@container \(max-width:\s*640px\)/);
        expect(css).toMatch(/\[data-page-header-middle\][^{]*\{[^}]*flex-basis:\s*100%/);
        // A basis for the search, so it never shrinks to a sliver when the bar is wide enough to keep it inline.
        expect(cssOf(screen.getByLabelText("mid").parentElement as HTMLElement)).toMatch(
            /flex:\s*1 1 200px/
        );
    });

    it("the subtitle is one line and is dropped on a phone", () => {
        wrap(<PageHeader subtitle="Context" title="T" />);
        const css = cssOf(screen.getByText("Context"));
        expect(css).toMatch(/display:\s*none/);
        expect(css).toMatch(/white-space:\s*nowrap/);
    });
});

describe("Inbox", () => {
    it("has the shared header with its title and subtitle", () => {
        wrap(<InboxHeader />);
        expect(document.querySelector("[data-page-header]")).not.toBeNull();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Inbox");
        expect(screen.getByText("Stay on top of notifications")).toBeInTheDocument();
    });
});

describe("Tasks", () => {
    const mount = (tm: Record<string, unknown> = {}, pm: Record<string, unknown> = {}) => {
        const props = {
            onCloseTaskHome: vi.fn(),
            onCreateProject: vi.fn(),
            onManageTags: vi.fn(),
            onDeleteProject: vi.fn(),
            handleCreateTask: vi.fn(),
            refreshProjectTasks: vi.fn(async () => undefined),
        };
        wrap(
            <TaskHeader
                myself={{ userId: "u1", teamId: "t1" } as never}
                setMyself={vi.fn()}
                socket={null}
                useCM={{ allChats: [] } as never}
                useTEM={{ teamMembers: [] } as never}
                useUISM={{} as never}
                usePM={
                    {
                        currentProject: { projectId: 7, projectName: "Apollo", isPrivate: false },
                        projects: [],
                        refreshProjectTasks: props.refreshProjectTasks,
                        ...pm,
                    } as never
                }
                useTM={
                    {
                        isCreatingTask: { flag: false },
                        handleCreateTask: props.handleCreateTask,
                        ...tm,
                    } as never
                }
                onCloseTaskHome={props.onCloseTaskHome}
                onCreateProject={props.onCreateProject}
                onDeleteProject={props.onDeleteProject}
                onManageTags={props.onManageTags}
            />
        );
        return props;
    };

    it("the project card became the shared header and kept every action", () => {
        const p = mount();
        expect(document.querySelector("[data-page-header]")).not.toBeNull();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Apollo");
        expect(screen.getByLabelText("Search tasks")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Task" }));
        expect(p.handleCreateTask).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Refresh Tasks" }));
        expect(p.refreshProjectTasks).toHaveBeenCalledWith(7);
        expect(screen.getByLabelText("More options")).toBeInTheDocument();
    });

    it("Close Panel appears only while a task preview or a create form is open, and closes", () => {
        mount();
        expect(screen.queryByRole("button", { name: "Close Panel" })).toBeNull();
        cleanup();
        const p = mount({ isTaskPreviewVisible: true });
        fireEvent.click(screen.getByRole("button", { name: "Close Panel" }));
        expect(p.onCloseTaskHome).toHaveBeenCalledTimes(1);
    });

    it("a private project shows its lock", () => {
        mount({}, { currentProject: { projectId: 7, projectName: "Apollo", isPrivate: true } });
        expect(document.querySelector("[data-page-header] h1 svg")).not.toBeNull();
    });
});

describe("the source", () => {
    it("Tasks, Inbox and the chat header use the shared bar, with no isDark or literal colour", () => {
        for (const rel of [
            "features/tasks/components/header/TaskHeader.tsx",
            "features/inbox/components/InboxHeader.tsx",
        ]) {
            const src = code(rel);
            expect(src, rel).toContain("PageHeader");
            expect(src, rel).not.toMatch(
                /isDark|useColorScheme|gradient|#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/
            );
        }
        const chat = code("features/chat/components/headers/MainChatPaneHeader.tsx");
        expect(chat).toContain("pageHeaderFrameSx");
        // The two hard-coded heights it had before are gone: the bar's height is one number.
        expect(chat).not.toMatch(/minHeight:\s*"(56|64)px"/);
    });
});
