/**
 * MIP-1155: a failing project delete shows a string.
 *
 * The dialog used to hand `error.response?.data` to React as-is; DRF can
 * answer an object (`{ detail }`, field errors), and an object child crashes
 * the render.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModalDeleteProject } from "../features/tasks/components/modals/ModalDeleteProject";
import { en } from "../i18n/locales/en";
import { errorMessageFrom } from "../utils/errorMessage";

const del = vi.hoisted(() => vi.fn());
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../services/api", () => ({ authApi: () => ({ delete: del }) }));

afterEach(() => {
    cleanup();
    del.mockReset();
});

const rejectWith = (status: number, data: unknown) =>
    del.mockRejectedValue(
        new axios.AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
            status,
            data,
        } as never)
    );

const mount = () =>
    render(
        <CssVarsProvider>
            <ModalDeleteProject
                myself={{ teamId: "t1" } as never}
                openDeleteProject={{ flag: true, projectId: 3, projectName: "Apollo" }}
                setOpenDeleteProject={vi.fn()}
                usePM={
                    {
                        teamProjects: [],
                        setCurrentProject: vi.fn(),
                        setTeamProjects: vi.fn(),
                    } as never
                }
            />
        </CssVarsProvider>
    );

const confirm = () =>
    fireEvent.click(
        screen.getByRole("button", { name: en.tasks.modals.deleteProject.confirmButton })
    );

describe("errorMessageFrom", () => {
    const fb = "fallback";
    it("passes a string through", () => expect(errorMessageFrom("Nope", fb)).toBe("Nope"));
    it("reads detail, then message, then error from an object", () => {
        expect(errorMessageFrom({ detail: "d", message: "m" }, fb)).toBe("d");
        expect(errorMessageFrom({ message: "m", error: "e" }, fb)).toBe("m");
        expect(errorMessageFrom({ error: "e" }, fb)).toBe("e");
    });
    it("falls back for anything that is not a usable string", () => {
        for (const bad of [
            undefined,
            null,
            "",
            "  ",
            42,
            {},
            { detail: { nested: 1 } },
            ["a"],
            "<html><body>502 Bad Gateway</body></html>",
        ]) {
            expect(errorMessageFrom(bad, fb)).toBe(fb);
        }
    });
});

describe("ModalDeleteProject failures", () => {
    it("shows the message of an object response instead of crashing", async () => {
        rejectWith(403, { detail: "Only the owner can delete this project." });
        mount();
        confirm();
        await waitFor(() =>
            expect(screen.getByText("Only the owner can delete this project.")).toBeTruthy()
        );
    });

    it("shows the fallback for an object it cannot read", async () => {
        rejectWith(400, { project_id: ["bad"] });
        mount();
        confirm();
        await waitFor(() =>
            expect(screen.getByText(en.tasks.modals.deleteProject.unexpectedError)).toBeTruthy()
        );
    });

    it("still shows a plain string response", async () => {
        rejectWith(500, "Something broke");
        mount();
        confirm();
        await waitFor(() => expect(screen.getByText("Something broke")).toBeTruthy());
    });
});
