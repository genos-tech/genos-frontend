import axios from "axios";

import { authApi } from "../../../services/api";
import type { AutomationRule, DryRunResult, RuleDefinition, RuleList, RuleRun } from "./types";

// A refusal is shown beside what caused it, so the global error toast stays out of it.
const QUIET = { suppressErrorToast: true } as const;

/** Why a request was refused: `code` is the server's reason, `field` the input it is about. */
export type Refusal = { ok: false; code: string; field: string };
export type Result<T> = { ok: true; data: T } | Refusal;

const url = (projectId: number, tail = "") => `/projects/${projectId}/automation-rules/${tail}`;

type Api = NonNullable<ReturnType<typeof authApi>>;

const call = async <T>(
    accessToken: string | null,
    run: (api: Api) => Promise<{ data: unknown }>
): Promise<Result<T>> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, code: "", field: "" };
        const res = await run(api);
        return { ok: true, data: res.data as T };
    } catch (error: unknown) {
        const response = axios.isAxiosError(error) ? error.response : undefined;
        const body = response?.data as { code?: string; field?: string } | undefined;
        console.error("An automation rule request failed:", error);
        const code = body?.code ?? (response?.status === 429 ? "throttled" : "");
        return { ok: false, code, field: body?.field ?? "" };
    }
};

export const loadRules = (projectId: number, accessToken: string | null) =>
    call<RuleList>(accessToken, (api) => api.get(url(projectId), QUIET));

export const createRule = (
    projectId: number,
    definition: RuleDefinition & { enabled: boolean },
    accessToken: string | null
) => call<AutomationRule>(accessToken, (api) => api.post(url(projectId), definition, QUIET));

export const updateRule = (
    projectId: number,
    ruleId: number,
    patch: Partial<RuleDefinition> & { enabled?: boolean },
    accessToken: string | null
) =>
    call<AutomationRule>(accessToken, (api) =>
        api.patch(url(projectId, `${ruleId}/`), patch, QUIET)
    );

export const deleteRule = (projectId: number, ruleId: number, accessToken: string | null) =>
    call<RuleList>(accessToken, (api) => api.delete(url(projectId, `${ruleId}/`), QUIET));

export const orderRules = (projectId: number, order: number[], accessToken: string | null) =>
    call<RuleList>(accessToken, (api) => api.put(url(projectId, "order/"), { order }, QUIET));

export const dryRunRule = (
    projectId: number,
    rule: RuleDefinition | { rule_id: number },
    accessToken: string | null
) => call<DryRunResult>(accessToken, (api) => api.post(url(projectId, "dry-run/"), rule, QUIET));

export const loadRuleRuns = (projectId: number, ruleId: number, accessToken: string | null) =>
    call<{ runs: RuleRun[] }>(accessToken, (api) =>
        api.get(url(projectId, `${ruleId}/runs/`), QUIET)
    );
