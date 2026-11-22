/**
 * Archive follow-ups (MIP-1933): the read-only gate decides from the item's own project, and a
 * v3 write refused as archived reaches the user as the archived toast.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { markProjectArchived, resetArchiveStateForTests } from "../features/archive/archiveState";
import { ProjectReadOnlyGate } from "../features/archive/ProjectReadOnly";
import { useProjectReadOnly } from "../features/archive/useProjectReadOnly";
import { attachArchivedToast } from "../services/api";
import { ChannelService } from "../services/channel/channelService";
import { subscribeRequestErrors, type RequestErrorKind } from "../services/requestErrorNotifier";
import type { ProjectProps } from "../types/tasks";

const project = (projectId: number) =>
    ({ projectId, projectName: `P${projectId}` }) as ProjectProps;

const Flag = () => <span data-testid="flag">{String(useProjectReadOnly())}</span>;

beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
});
afterAll(() => {
    vi.useRealTimers();
});
afterEach(() => resetArchiveStateForTests());

describe("ProjectReadOnlyGate", () => {
    it("is not read-only outside any provider", () => {
        render(<Flag />);
        expect(screen.getByTestId("flag").textContent).toBe("false");
    });

    it("makes an archived item's editors inert, whichever project the page selected", () => {
        // The page has project 1 selected; the item itself belongs to the archived project 2.
        markProjectArchived(project(2), true);
        const onClick = vi.fn();
        const { container } = render(
            <ProjectReadOnlyGate projectId={2}>
                <button onClick={onClick}>edit</button>
                <Flag />
            </ProjectReadOnlyGate>
        );
        expect(screen.getByTestId("flag").textContent).toBe("true");
        expect(container.querySelector("[inert]")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "edit" }));
        // jsdom ignores `inert` for dispatched events, so the contract asserted is the attribute.
        expect(screen.getByRole("button", { name: "edit" }).closest("[inert]")).not.toBeNull();
    });

    it("leaves a live project's item editable even when another project is archived", () => {
        markProjectArchived(project(2), true);
        const { container } = render(
            <ProjectReadOnlyGate projectId={1}>
                <Flag />
            </ProjectReadOnlyGate>
        );
        expect(screen.getByTestId("flag").textContent).toBe("false");
        expect(container.querySelector("[inert]")).toBeNull();
    });

    it("follows an archive made while it is open", () => {
        const { container } = render(
            <ProjectReadOnlyGate projectId={3}>
                <Flag />
            </ProjectReadOnlyGate>
        );
        expect(container.querySelector("[inert]")).toBeNull();
        act(() => markProjectArchived(project(3), true));
        expect(container.querySelector("[inert]")).not.toBeNull();
        expect(screen.getByTestId("flag").textContent).toBe("true");
    });
});

const refuse = (instance: ReturnType<typeof axios.create>, status: number, data: unknown) => {
    instance.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const response: AxiosResponse = { data, status, statusText: "", headers: {}, config };
        throw new AxiosError("refused", "ERR_BAD_REQUEST", config, {}, response);
    };
};

// The notifier drops a repeat of the same kind inside a short window: step the clock past it.
let clock = Date.parse("2026-11-22T00:00:00Z");
const kinds = async (send: () => Promise<unknown>) => {
    clock += 60_000;
    vi.setSystemTime(clock);
    const seen: RequestErrorKind[] = [];
    const stop = subscribeRequestErrors((k) => seen.push(k));
    await send().catch(() => undefined);
    stop();
    return seen;
};

describe("v3 409 archived", () => {
    it("shows the archived toast on an attached instance, and only for code=archived", async () => {
        const api = attachArchivedToast(axios.create());
        refuse(api, 409, { code: "archived" });
        expect(await kinds(() => api.post("/x"))).toEqual(["archived"]);
        refuse(api, 409, { error: "other" });
        expect(await kinds(() => api.post("/x"))).toEqual([]);
        refuse(api, 500, {});
        expect(await kinds(() => api.post("/x"))).toEqual([]);
    });

    it("reaches the chat service's own v3 instance", async () => {
        const service = new ChannelService();
        service.setAccessToken("tok");
        const api = (service as unknown as { api: () => ReturnType<typeof axios.create> }).api();
        refuse(api, 409, { code: "archived", error: "archived" });
        expect(await kinds(() => api.post("/api/v3/channels/c/archive/"))).toEqual(["archived"]);
    });
});
