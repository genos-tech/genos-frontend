/**
 * Shared MSW (Mock Service Worker) server for tests that exercise the
 * axios-backed service layer against realistic HTTP responses.
 *
 * Deliberately set up PER-FILE (not globally in setup.ts) so the existing
 * 291-test green baseline — which mocks the api module directly — stays
 * untouched. In a test file that needs HTTP mocking:
 *
 *   import { http, HttpResponse } from "msw";
 *   import { server } from "../msw/server";
 *
 *   beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 *   it("...", async () => {
 *     server.use(http.get("*\/api/v3/channels/", () => HttpResponse.json({ channels: [] })));
 *     ...
 *   });
 */

import { setupServer } from "msw/node";

// No default handlers — each test installs its own via server.use(...).
export const server = setupServer();
