import { describe, expect, it } from "vitest";

import { authApi, nonAuthApi } from "../services/api";

describe("nonAuthApi", () => {
    it("creates an axios instance with correct config", () => {
        const api = nonAuthApi();
        expect(api).toBeDefined();
        expect(api.defaults.withCredentials).toBe(true);
        expect(api.defaults.headers["Content-Type"]).toBe("application/json");
    });
});

describe("authApi", () => {
    it("returns null when no token is provided", () => {
        expect(authApi(null)).toBeNull();
        expect(authApi(undefined)).toBeNull();
        expect(authApi("")).toBeNull();
    });

    it("creates an axios instance with auth header when token is provided", () => {
        const api = authApi("test-token-123");
        expect(api).toBeDefined();
        expect(api!.defaults.headers["Authorization"]).toBe("Bearer test-token-123");
        expect(api!.defaults.headers["Content-Type"]).toBe("application/json");
    });
});
