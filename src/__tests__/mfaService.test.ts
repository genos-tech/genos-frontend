// MIP-2239: the client side of the two-step sign-in protocol. The password step answers either a
// session or `mfa_required` plus a pending token (and no session, so nothing to store); every
// refusal of the /user/mfa endpoints is read from its `code`, never from prose.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signIn } from "../features/admin/services/signin";
import {
    confirmMfaSetup,
    disableMfa,
    getMfaStatus,
    lockMinutes,
    newRecoveryCodes,
    signInWithCode,
    startMfaSetup,
} from "../features/security/services/mfa";

const post = vi.fn();
const get = vi.fn();

vi.mock("../services/api", () => ({
    nonAuthApi: () => ({ post: (...a: unknown[]) => post(...a) }),
    authApi: (token: string | null) =>
        token
            ? { post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a) }
            : null,
}));

const refused = (status: number, data: unknown) =>
    Object.assign(new Error("refused"), {
        isAxiosError: true,
        response: { status, data },
    });

beforeEach(() => {
    vi.clearAllMocks();
});

describe("signIn", () => {
    it("returns the pending token, and nothing that looks like a session, when two-step is on", async () => {
        post.mockResolvedValue({
            data: { mfa_required: true, mfa_token: "tok", expires_in: 300 },
        });
        const res = await signIn("a@b.c", "pw");
        expect(res).toEqual({ kind: "mfa", token: "tok" });
        expect(res).not.toHaveProperty("access");
    });

    it("still returns the session for an account without it", async () => {
        post.mockResolvedValue({ data: { access: "a", user_id: "u" } });
        const res = await signIn("a@b.c", "pw");
        expect(res).toMatchObject({ access: "a" });
    });

    it("ignores an mfa_required without a token", async () => {
        post.mockResolvedValue({ data: { mfa_required: true } });
        const res = await signIn("a@b.c", "pw");
        expect(res).not.toHaveProperty("kind");
    });
});

describe("signInWithCode", () => {
    it("posts the token and the code and returns the session", async () => {
        post.mockResolvedValue({ data: { access: "a" } });
        const res = await signInWithCode("pending", "123456");
        expect(post).toHaveBeenCalledWith(
            "/user/signin/mfa/",
            { mfa_token: "pending", code: "123456" },
            { suppressErrorToast: true }
        );
        expect(res).toEqual({ ok: true, data: { access: "a" } });
    });

    it("reads each refusal from its code", async () => {
        for (const code of ["invalid_code", "mfa_token_invalid", "bad_password"] as const) {
            post.mockRejectedValueOnce(refused(401, { code }));
            expect(await signInWithCode("p", "1")).toMatchObject({ ok: false, code });
        }
    });

    it("carries the lock's wait", async () => {
        post.mockRejectedValue(refused(429, { code: "mfa_locked", retry_after: 840 }));
        expect(await signInWithCode("p", "1")).toEqual({
            ok: false,
            code: "mfa_locked",
            retryAfterSeconds: 840,
        });
    });

    it("tells a bare 429 (the rate limit) from the lock", async () => {
        post.mockRejectedValue(refused(429, { detail: "Request was throttled." }));
        expect(await signInWithCode("p", "1")).toMatchObject({ ok: false, code: "throttled" });
    });

    it("tells a network failure from a refusal, and does not trust an unknown code", async () => {
        post.mockRejectedValueOnce(Object.assign(new Error("net"), { isAxiosError: true }));
        expect(await signInWithCode("p", "1")).toMatchObject({ ok: false, code: "network" });
        post.mockRejectedValueOnce(refused(500, { code: "<script>" }));
        expect(await signInWithCode("p", "1")).toMatchObject({ ok: false, code: "unknown" });
    });
});

describe("the signed-in endpoints", () => {
    it("start setup posts the password and returns the secret and link", async () => {
        post.mockResolvedValue({ data: { secret: "ABC", otpauth_uri: "otpauth://x" } });
        const res = await startMfaSetup("tok", "pw");
        expect(post).toHaveBeenCalledWith(
            "/user/mfa/setup/",
            { password: "pw" },
            expect.anything()
        );
        expect(res).toEqual({ ok: true, data: { secret: "ABC", otpauthUri: "otpauth://x" } });
    });

    it("confirm returns the recovery codes", async () => {
        post.mockResolvedValue({ data: { enabled: true, recovery_codes: ["A", "B"] } });
        expect(await confirmMfaSetup("tok", "123456")).toEqual({ ok: true, data: ["A", "B"] });
    });

    it("disable and new codes send the password", async () => {
        post.mockResolvedValue({ data: { enabled: false, recovery_codes: ["Z"] } });
        await disableMfa("tok", "pw");
        expect(post).toHaveBeenLastCalledWith(
            "/user/mfa/disable/",
            { password: "pw" },
            expect.anything()
        );
        expect(await newRecoveryCodes("tok", "pw")).toEqual({ ok: true, data: ["Z"] });
        expect(post).toHaveBeenLastCalledWith(
            "/user/mfa/recovery-codes/",
            { password: "pw" },
            expect.anything()
        );
    });

    it("a wrong password is read from its code", async () => {
        post.mockRejectedValue(refused(403, { code: "bad_password" }));
        expect(await disableMfa("tok", "x")).toMatchObject({ ok: false, code: "bad_password" });
    });

    it("sends nothing without a token", async () => {
        expect(await startMfaSetup(null, "pw")).toMatchObject({ ok: false });
        expect(await getMfaStatus(null)).toBeNull();
        expect(post).not.toHaveBeenCalled();
    });

    it("status maps the wire shape, and is null on failure", async () => {
        get.mockResolvedValueOnce({
            data: {
                enabled: true,
                eligible: true,
                enabled_at: "2026-11-24T00:00:00Z",
                recovery_codes_remaining: 7,
            },
        });
        expect(await getMfaStatus("tok")).toEqual({
            enabled: true,
            eligible: true,
            enabledAt: "2026-11-24T00:00:00Z",
            recoveryCodesRemaining: 7,
        });
        get.mockRejectedValueOnce(new Error("boom"));
        expect(await getMfaStatus("tok")).toBeNull();
    });
});

describe("lockMinutes", () => {
    it("rounds up and never shows less than a minute", () => {
        expect(lockMinutes(1)).toBe(1);
        expect(lockMinutes(60)).toBe(1);
        expect(lockMinutes(61)).toBe(2);
        expect(lockMinutes(undefined)).toBe(1);
    });
});
