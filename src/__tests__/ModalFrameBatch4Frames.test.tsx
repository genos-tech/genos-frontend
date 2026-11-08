/**
 * MIP-1126 batch 4: the rendered frames of the dialogs that can be mounted with small props:
 * the shared image lightbox, Import Markdown, the custom pause time, the task graph, the
 * sprint manager, the install how-to and the sign-in "forgot password" dialog. Each is a
 * ModalFrame dialog with the right name, the right layer and a flat surface. Layers are read
 * from the modal root (`role="presentation"`), the element that carries the z-index.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { InstallBanner } from "../components/layout/InstallBanner";
import { ImageZoomModal } from "../components/messageBody/ImageZoomModal";
import { NoteModalHostZIndexProvider } from "../components/modals/noteModalHostZIndex";
import { useAuth } from "../context/AuthContext";
import { SignInForm } from "../features/admin/components/SignInForm";
import { requestPasswordReset } from "../features/admin/services/passwordReset";
import { ModalImportMarkdown } from "../features/notes/common/components/ModalImportMarkdown";
import { ModalTaskDiagram } from "../features/tasks/diagram/components/ModalTaskDiagram";
import { useDiagramZIndex } from "../features/tasks/diagram/diagramZIndex";
import { SprintManagerDialog } from "../features/tasks/sprint-milestone/components/SprintManagerDialog";
import { NotificationPauseSection } from "../services/notifications/NotificationPausePicker";
import { downloadFile } from "../utils/downloadUtils";

vi.mock("../utils/downloadUtils", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../utils/downloadUtils")>()),
    downloadFile: vi.fn(async () => undefined),
}));
vi.mock("../context/AuthContext", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../context/AuthContext")>()),
    useAuth: vi.fn(),
    useOptionalAccessToken: () => "tok",
}));
vi.mock("../db/utils", () => ({
    DatabaseUtils: { clearTeamScopedStores: vi.fn(async () => undefined) },
}));
vi.mock("../features/admin/services/passwordReset", () => ({
    requestPasswordReset: vi.fn(async () => true),
}));
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => true }));
vi.mock("../hooks/common/useInstallPrompt", () => ({
    isIOSDevice: () => true,
    isStandaloneDisplay: () => false,
    useInstallPrompt: () => ({ canPrompt: false, promptInstall: vi.fn() }),
}));
// The canvas is its own big surface; here it only reports the layer it was handed.
vi.mock("../features/tasks/diagram/components/TaskFlowCanvas", () => ({
    TaskFlowCanvas: () => {
        const z = useDiagramZIndex();
        return <div data-testid="canvas" data-z={z} />;
    },
}));

const wrap = (ui: React.ReactElement) => render(<CssVarsProvider>{ui}</CssVarsProvider>);

const facts = () => {
    const dialog = screen.getByRole("dialog");
    const title = document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent;
    const root = screen.getByRole("presentation");
    const css = cssOf(dialog);
    return {
        title,
        layer: getComputedStyle(root).zIndex,
        popup: getComputedStyle(root).getPropertyValue("--unstable_popup-zIndex"),
        gradient: /gradient/i.test(css),
        shadows: css.match(/box-shadow:[^;]*/g),
    };
};
const FLAT = { gradient: false, shadows: ["box-shadow: var(--g-shadow-lg)"] };

beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useAuth).mockReturnValue({ setAccessToken: vi.fn() } as never);
});
afterEach(cleanup);

describe("ImageZoomModal (the one lightbox)", () => {
    it("is a flat frame at the page layer, named, with the image, a download and an X", () => {
        wrap(<ImageZoomModal src="blob:img-1" onClose={vi.fn()} />);
        expect(facts()).toMatchObject({ title: "Image preview", layer: "10010", ...FLAT });
        expect(screen.getByRole("img").getAttribute("src")).toBe("blob:img-1");
        expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    });

    it("renders nothing without a src", () => {
        wrap(<ImageZoomModal src={null} onClose={vi.fn()} />);
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("sits above its host, or at an exact layer", () => {
        const view = wrap(<ImageZoomModal hostZIndex={10020} src="blob:x" onClose={vi.fn()} />);
        expect(facts()).toMatchObject({ layer: "10022", popup: "10032" });
        view.unmount();
        wrap(<ImageZoomModal src="blob:x" zIndex={12000} onClose={vi.fn()} />);
        expect(facts().layer).toBe("12000");
    });

    // MIP-1193: a picture zoomed from a task / chat preview shown in UrlLinkModal (which
    // provides its own layer) opened at the page layer, 10010: behind the 10020 preview.
    it("opens above a modal-hosted preview that provides its layer, without a prop", () => {
        const view = wrap(
            <NoteModalHostZIndexProvider value={10020}>
                <ImageZoomModal src="blob:x" onClose={vi.fn()} />
            </NoteModalHostZIndexProvider>
        );
        expect(facts().layer).toBe("10022");
        view.unmount();
        wrap(
            <NoteModalHostZIndexProvider value={13200}>
                <ImageZoomModal src="blob:x" onClose={vi.fn()} />
            </NoteModalHostZIndexProvider>
        );
        expect(facts().layer).toBe("13202");
    });

    it("on a page surface (no host) keeps the page layer", () => {
        wrap(<ImageZoomModal src="blob:x" onClose={vi.fn()} />);
        expect(facts().layer).toBe("10010");
    });

    it("an explicit host prop wins over the context", () => {
        wrap(
            <NoteModalHostZIndexProvider value={10020}>
                <ImageZoomModal hostZIndex={13200} src="blob:x" onClose={vi.fn()} />
            </NoteModalHostZIndexProvider>
        );
        expect(facts().layer).toBe("13202");
    });

    it("downloads under the host's filename stem, as each inlined copy did", async () => {
        wrap(<ImageZoomModal filenameStem="task-preview-image" src="blob:x" onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "Download" }));
        await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(1));
        const [url, name] = vi.mocked(downloadFile).mock.calls[0] as [string, string];
        expect(url).toBe("blob:x");
        expect(name).toMatch(/^task-preview-image-.*\.png$/);
    });

    it("a host's own download replaces the default one", async () => {
        const onDownload = vi.fn();
        wrap(<ImageZoomModal src="blob:y" onClose={vi.fn()} onDownload={onDownload} />);
        fireEvent.click(screen.getByRole("button", { name: "Download" }));
        await waitFor(() => expect(onDownload).toHaveBeenCalledWith("blob:y"));
        expect(downloadFile).not.toHaveBeenCalled();
    });

    it("the X and Escape close it", () => {
        const onClose = vi.fn();
        wrap(<ImageZoomModal src="blob:x" onClose={onClose} />);
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(onClose.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});

describe("Import Markdown", () => {
    const useNM = new Proxy(
        { myNoteFolders: [], teamNoteFolders: [], taskNoteMeta: [], chatNoteMeta: [] },
        { get: (t, k) => (k in t ? (t as never)[k] : vi.fn()) }
    ) as never;
    const props = {
        open: true,
        context: { kind: "my", folderId: null } as const,
        myself: { userId: "u1", teamId: "t1" } as never,
        useNM,
        onClose: vi.fn(),
    };

    it("is a flat frame on Joy's layer on a page; Import waits for a file and a title", () => {
        wrap(<ModalImportMarkdown {...props} />);
        expect(facts()).toMatchObject({ title: "Import Markdown", layer: "1300", ...FLAT });
        const importBtn = screen.getByRole("button", { name: /^Import$/ }) as HTMLButtonElement;
        expect(importBtn.disabled).toBe(true);
    });

    it("sits one above a UrlLinkModal host and writes the picker layer for its listbox", () => {
        wrap(<ModalImportMarkdown {...props} hostZIndex={10020} />);
        expect(facts()).toMatchObject({ layer: "10021", popup: "10031" });
        expect(cssOf(screen.getByRole("presentation"))).toMatch(
            /~\s*\[role="listbox"\]\s*\{[^}]*--unstable_popup-zIndex: 10031/
        );
    });
});

describe("custom pause time", () => {
    it("opens a small frame above the profile dialog (10020) from the duration menu", async () => {
        const noop = vi.fn(async () => undefined);
        const pause = {
            isPausedNow: false,
            snoozeUntil: null,
            snoozeSchedule: null,
            pauseFor: noop,
            pauseUntilTomorrow: noop,
            pauseUntilNextWeek: noop,
            pauseUntil: vi.fn(async () => undefined),
            resume: noop,
            setSchedule: noop,
        };
        wrap(<NotificationPauseSection pause={pause as never} />);
        fireEvent.click(screen.getByRole("button", { name: /Pause for/ }));
        fireEvent.click(await screen.findByRole("menuitem", { name: /Pick a date/ }));
        expect(facts()).toMatchObject({ title: "Pause until", layer: "10020", ...FLAT });
        // opened seeded one hour ahead: Set commits it
        fireEvent.click(screen.getByRole("button", { name: "Set" }));
        expect(pause.pauseUntil).toHaveBeenCalledTimes(1);
    });
});

describe("task graph dialog", () => {
    const diagram = (zIndex?: number) => (
        <ModalTaskDiagram
            myself={{ userId: "u1", teamId: "t1" } as never}
            projectId={1}
            rootLabel="KDS-5 · Five"
            rootTaskId={5}
            usePM={{} as never}
            useTM={{} as never}
            zIndex={zIndex}
            open
            onClose={vi.fn()}
        />
    );

    it("page-hosted: a flat frame at 9999 that names the root, and hands 9999 to the canvas", () => {
        wrap(diagram());
        expect(facts()).toMatchObject({ title: "Task graph", layer: "9999", ...FLAT });
        expect(screen.getByRole("dialog").textContent).toContain("KDS-5 · Five");
        expect(screen.getByTestId("canvas").getAttribute("data-z")).toBe("9999");
    });

    it("modal-hosted: keeps the exact layer its opener gave it, for the canvas too", () => {
        wrap(diagram(10035));
        expect(facts().layer).toBe("10035");
        expect(screen.getByTestId("canvas").getAttribute("data-z")).toBe("10035");
    });

    it("never claims sibling listboxes (it owns none: the fe #122 bug)", () => {
        wrap(diagram(10035));
        // Joy's own root carries a sibling rule at its default layer; the frame must not add its
        // own at the dialog's layer + 10 (10045 here).
        expect(cssOf(screen.getByRole("presentation"))).not.toMatch(
            /~\s*\[role="listbox"\]\s*\{[^}]*10045/
        );
    });

    it("the X keeps the graph's own label", () => {
        wrap(diagram());
        expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    });
});

describe("sprint manager", () => {
    it("is a wide flat frame on Joy's layer, named by its title", () => {
        const useSM = {
            projectSprints: { 1: [] },
            projectMilestones: {},
            loadSprintsForProject: vi.fn(),
            loadMilestonesForProject: vi.fn(),
        } as never;
        wrap(<SprintManagerDialog projectId={1} useSM={useSM} open onClose={vi.fn()} />);
        expect(facts()).toMatchObject({ layer: "1300", ...FLAT });
        expect(facts().title).toBeTruthy();
    });
});

describe("install how-to (iOS)", () => {
    it("opens as a frame on Joy's layer from the banner's button; Done closes it", () => {
        wrap(<InstallBanner />);
        fireEvent.click(
            screen.getAllByRole("button").find((b) => /how/i.test(b.textContent ?? ""))!
        );
        expect(facts()).toMatchObject({ layer: "1300", ...FLAT });
        fireEvent.click(screen.getByRole("button", { name: "Done" }));
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});

describe("sign-in: forgot password", () => {
    const open = () => {
        wrap(
            <MemoryRouter>
                <SignInForm />
            </MemoryRouter>
        );
        fireEvent.click(screen.getByRole("button", { name: /forgot/i }));
    };

    it("is a small flat frame on Joy's layer; Send is tied to the form and waits for an email", () => {
        open();
        expect(facts()).toMatchObject({ title: "Forgot Password?", layer: "1300", ...FLAT });
        const send = screen.getByRole("button", { name: "Send reset link" }) as HTMLButtonElement;
        expect(send.type).toBe("submit");
        expect(send.disabled).toBe(true);
        const form = screen.getByRole("dialog").querySelector("form")!;
        expect(send.getAttribute("form")).toBe(form.id);
        fireEvent.change(
            within(screen.getByRole("dialog")).getByPlaceholderText("Enter your email"),
            {
                target: { value: "me@example.com" },
            }
        );
        expect(send.disabled).toBe(false);
    });

    it("submits the typed email and shows the success state with only Close", async () => {
        open();
        fireEvent.change(
            within(screen.getByRole("dialog")).getByPlaceholderText("Enter your email"),
            {
                target: { value: "me@example.com" },
            }
        );
        const form = screen.getByRole("dialog").querySelector("form")!;
        await act(async () => {
            fireEvent.submit(form);
        });
        expect(requestPasswordReset).toHaveBeenCalledWith("me@example.com", expect.any(Function));
        await waitFor(() => expect(facts().title).toBe("Check your inbox"));
        expect(screen.queryByRole("button", { name: "Send reset link" })).toBeNull();
    });

    // MIP-1193: the answer to a request still in flight when the dialog was closed used to
    // land on the NEXT open and leave "Check your inbox" with no form.
    it("an answer that arrives after Close does not show up on the next open", async () => {
        let answer!: (ok: boolean) => void;
        (requestPasswordReset as ReturnType<typeof vi.fn>).mockImplementationOnce(
            () => new Promise<boolean>((resolve) => (answer = resolve))
        );
        open();
        fireEvent.change(
            within(screen.getByRole("dialog")).getByPlaceholderText("Enter your email"),
            { target: { value: "me@example.com" } }
        );
        await act(async () => {
            fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
        });
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        fireEvent.click(screen.getByRole("button", { name: /forgot/i }));

        await act(async () => answer(true));

        expect(facts().title).toBe("Forgot Password?");
        expect(screen.getByRole("button", { name: "Send reset link" })).toBeTruthy();
    });

    it("an error that arrives after Close is not shown on the next open", async () => {
        let fail!: () => void;
        (requestPasswordReset as ReturnType<typeof vi.fn>).mockImplementationOnce(
            (_email: string, onError: (message: string) => void) =>
                new Promise<boolean>((resolve) => {
                    fail = () => {
                        onError("Too many requests");
                        resolve(false);
                    };
                })
        );
        open();
        fireEvent.change(
            within(screen.getByRole("dialog")).getByPlaceholderText("Enter your email"),
            { target: { value: "me@example.com" } }
        );
        await act(async () => {
            fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
        });
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        fireEvent.click(screen.getByRole("button", { name: /forgot/i }));
        await act(async () => fail());
        expect(screen.queryByText("Too many requests")).toBeNull();
    });

    it("the X, the Close button and Escape all close it; the next open starts on the form", async () => {
        open();
        for (const closer of [
            () => fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]),
            () => fireEvent.click(screen.getAllByRole("button", { name: "Close" })[1]),
            () => fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }),
        ]) {
            expect(facts().title).toBe("Forgot Password?");
            closer();
            await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
            fireEvent.click(screen.getByRole("button", { name: /forgot/i }));
        }
    });
});

describe("UrlLinkModal hands its layer to what opens from inside it (MIP-1193)", () => {
    it("wraps every view in the host-layer provider at its own effective layer", () => {
        const source = readFileSync(
            join(
                dirname(fileURLToPath(import.meta.url)),
                "..",
                "components",
                "modals",
                "UrlLinkModal.tsx"
            ),
            "utf8"
        );
        expect(source).toMatch(
            /<NoteModalHostZIndexProvider value=\{effectiveZIndex\}>\s*<Suspense fallback=\{<ViewLoadingFallback \/>\}>\{renderBody\(\)\}<\/Suspense>\s*<\/NoteModalHostZIndexProvider>/
        );
    });
});
