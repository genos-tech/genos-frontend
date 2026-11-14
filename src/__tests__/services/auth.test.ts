import { beforeEach, describe, expect, it, vi } from "vitest";

import { signIn } from "../../features/admin/services/signin";
import { signUp } from "../../features/admin/services/signup";
import { nonAuthApi } from "../../services/api";

vi.mock("../../services/api", () => ({
    nonAuthApi: vi.fn(),
    authApi: vi.fn(),
}));

describe("signIn", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call POST /user/signin/ and return data on success", async () => {
        const mockData = {
            access: "tok123",
            username: "testuser",
            user_id: "1",
            email: "test@test.com",
        };
        const mockPost = vi.fn().mockResolvedValue({ data: mockData });
        (nonAuthApi as ReturnType<typeof vi.fn>).mockReturnValue({ post: mockPost });

        const result = await signIn("test@test.com", "password123");

        expect(nonAuthApi).toHaveBeenCalled();
        expect(mockPost).toHaveBeenCalledWith("/user/signin/", {
            email: "test@test.com",
            password: "password123",
        });
        expect(result).toEqual(mockData);
    });

    it("should call setErrorMessage on 401 error", async () => {
        const mockPost = vi.fn().mockRejectedValue({
            isAxiosError: true,
            response: { status: 401, data: { detail: "Invalid credentials" } },
        });
        (nonAuthApi as ReturnType<typeof vi.fn>).mockReturnValue({ post: mockPost });

        const axios = await import("axios");
        vi.spyOn(axios.default, "isAxiosError").mockReturnValue(true);

        const setError = vi.fn();
        await signIn("bad@test.com", "wrong", setError);
        expect(setError).toHaveBeenCalledWith("Unauthorized. Please log in again.");
    });
});

describe("signUp", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call POST /user/signup/ and return data on success", async () => {
        const mockData = { message: "User created" };
        const mockPost = vi.fn().mockResolvedValue({ data: mockData });
        (nonAuthApi as ReturnType<typeof vi.fn>).mockReturnValue({ post: mockPost });

        const result = await signUp("newuser", "new@test.com", "pass123");

        expect(mockPost).toHaveBeenCalledWith("/user/signup/", {
            username: "newuser",
            email: "new@test.com",
            password: "pass123",
            accepted_terms: false,
        });
        // The page never asks for a system user: the server makes a project's own.
        expect(mockPost.mock.calls[0][1]).not.toHaveProperty("is_system_user");
        expect(result).toEqual(mockData);
    });

    it("should call setErrorMessage on 400 error", async () => {
        const mockPost = vi.fn().mockRejectedValue({
            isAxiosError: true,
            response: { status: 400, data: { email: "already exists" } },
        });
        (nonAuthApi as ReturnType<typeof vi.fn>).mockReturnValue({ post: mockPost });

        const axios = await import("axios");
        vi.spyOn(axios.default, "isAxiosError").mockReturnValue(true);

        const setError = vi.fn();
        await signUp("user", "dup@test.com", "pass", setError);
        expect(setError).toHaveBeenCalledWith("Please try with a different email.");
    });

    it("sends accepted_terms=true when the form's checkbox was ticked", async () => {
        const mockPost = vi.fn().mockResolvedValue({ data: {} });
        (nonAuthApi as ReturnType<typeof vi.fn>).mockReturnValue({ post: mockPost });

        await signUp("newuser", "new@test.com", "pass123", undefined, undefined, true);

        expect(mockPost.mock.calls[0][1]).toMatchObject({ accepted_terms: true });
    });

    it("explains a terms_not_accepted refusal instead of blaming the email", async () => {
        const mockPost = vi.fn().mockRejectedValue({
            isAxiosError: true,
            response: { status: 400, data: { code: "terms_not_accepted" } },
        });
        (nonAuthApi as ReturnType<typeof vi.fn>).mockReturnValue({ post: mockPost });

        const axios = await import("axios");
        vi.spyOn(axios.default, "isAxiosError").mockReturnValue(true);

        const setError = vi.fn();
        await signUp("user", "u@test.com", "pass", setError);
        expect(setError).toHaveBeenCalledWith(
            "Please agree to the Terms of Service and the Privacy Policy to create an account."
        );
    });
});
