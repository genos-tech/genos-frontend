/**
 * A real browser for a test that has to LAY THINGS OUT (jsdom lays nothing out and evaluates no
 * `@media`): the project's own Vite dev server serves a harness page, and an installed Chrome
 * loads it headless over the DevTools protocol, with no added dependency (Node's global
 * `WebSocket` is the protocol client). Touch is emulated the way Chrome's device mode does it, so
 * `(pointer: coarse)` and `(hover: none)` match and a tap is a real touch event.
 *
 * `findChrome()` is `null` where no Chrome is installed (a test then skips, except in CI, where
 * one is expected: `ubuntu-latest` ships Google Chrome).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { createServer, type Plugin, type ViteDevServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const CHROME_PATHS = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

export const findChrome = (): string | null =>
    CHROME_PATHS.find((p): p is string => !!p && existsSync(p)) ?? null;

/** The harness has no sign-in: the real `AuthProvider` (token refresh, sockets) is swapped for a token. */
const stubAuth = (): Plugin => ({
    name: "stub-auth-context",
    enforce: "pre",
    load(id) {
        const path = id.replace(/\\/g, "/");
        if (path.endsWith("/src/context/authState.ts")) {
            return `export const useAuth = () => ({ accessToken: "t", setAccessToken: () => {} });
export const useOptionalAccessToken = () => "t";
export const AUTH_LOCAL_STORAGE_KEYS = [];
export const DEVICE_PREFERENCE_LOCAL_STORAGE_KEYS = [];
export const TRANSIENT_HANDOFF_LOCAL_STORAGE_KEYS = [];
export const clearUserScopedLocalStorage = () => {};`;
        }
        if (path.endsWith("/src/context/AuthContext.tsx")) {
            return "export const AuthProvider = ({ children }) => children;";
        }
        return null;
    },
});

export const startHarnessServer = async (): Promise<{ server: ViteDevServer; origin: string }> => {
    const server = await createServer({
        root: ROOT,
        configFile: false,
        logLevel: "error",
        plugins: [stubAuth(), react(), tailwindcss()],
        server: { port: 0, strictPort: false, host: "127.0.0.1", hmr: false },
        optimizeDeps: { entries: ["src/__tests__/browser/*.html"] },
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("no dev server address");
    return { server, origin: `http://127.0.0.1:${address.port}` };
};

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class Page {
    private nextId = 1;
    private readonly pending = new Map<number, Pending>();
    private readonly listeners: ((method: string, params: unknown) => void)[] = [];

    constructor(private readonly ws: WebSocket) {
        ws.addEventListener("message", (ev) => {
            const msg = JSON.parse(String(ev.data));
            if (msg.id) {
                const p = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                if (msg.error) p?.reject(new Error(`${msg.error.message}`));
                else p?.resolve(msg.result);
            } else {
                this.listeners.forEach((l) => l(msg.method, msg.params));
            }
        });
    }

    send<T = unknown>(method: string, params: object = {}): Promise<T> {
        const id = this.nextId++;
        return new Promise<T>((resolve, reject) => {
            this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    on(listener: (method: string, params: unknown) => void) {
        this.listeners.push(listener);
    }

    /** Evaluate an expression in the page and return its JSON value. */
    async eval<T>(expression: string): Promise<T> {
        const res = await this.send<{
            result: { value: T };
            exceptionDetails?: { text: string; exception?: { description?: string } };
        }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        if (res.exceptionDetails) {
            throw new Error(
                `page eval failed: ${res.exceptionDetails.exception?.description ?? res.exceptionDetails.text}`
            );
        }
        return res.result.value;
    }

    /** A real touch: touchStart + touchEnd at CSS px (x, y); the browser then synthesises the click. */
    async tap(x: number, y: number) {
        await this.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y }],
        });
        await this.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }

    async screenshot(): Promise<Buffer> {
        const res = await this.send<{ data: string }>("Page.captureScreenshot", {
            format: "png",
        });
        return Buffer.from(res.data, "base64");
    }

    close() {
        this.ws.close();
    }
}

export type Browser = {
    open: (url: string, opts: { width: number; height: number; touch: boolean }) => Promise<Page>;
    close: () => Promise<void>;
};

export const launchChrome = async (chrome: string): Promise<Browser> => {
    const dir = mkdtempSync(join(tmpdir(), "genos-probe-"));
    const proc: ChildProcess = spawn(
        chrome,
        [
            "--headless=new",
            "--remote-debugging-port=0",
            `--user-data-dir=${dir}`,
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            "about:blank",
        ],
        { stdio: ["ignore", "ignore", "pipe"] }
    );
    const wsUrl = await new Promise<string>((resolve, reject) => {
        let buf = "";
        const timer = setTimeout(() => reject(new Error(`chrome did not start: ${buf}`)), 30_000);
        proc.stderr!.on("data", (d) => {
            buf += String(d);
            const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
            if (m) {
                clearTimeout(timer);
                resolve(m[1]);
            }
        });
        proc.on("exit", () => reject(new Error(`chrome exited early: ${buf}`)));
    });
    const port = new URL(wsUrl).port;

    return {
        async open(url, { width, height, touch }) {
            const target = (await (
                await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })
            ).json()) as { webSocketDebuggerUrl: string };
            const ws = new WebSocket(target.webSocketDebuggerUrl);
            await new Promise((resolve, reject) => {
                ws.addEventListener("open", resolve, { once: true });
                ws.addEventListener("error", reject, { once: true });
            });
            const page = new Page(ws);
            await page.send("Page.enable");
            await page.send("Runtime.enable");
            await page.send("Emulation.setDeviceMetricsOverride", {
                width,
                height,
                deviceScaleFactor: touch ? 3 : 1,
                mobile: touch,
            });
            if (touch) {
                await page.send("Emulation.setTouchEmulationEnabled", {
                    enabled: true,
                    maxTouchPoints: 5,
                });
            }
            const loaded = new Promise<void>((resolve) =>
                page.on((method) => method === "Page.loadEventFired" && resolve())
            );
            await page.send("Page.navigate", { url });
            await loaded;
            return page;
        },
        async close() {
            // Chrome's helper processes can still be writing to the profile when the parent is
            // killed: wait for the exit, and never let a failed clean-up of a temp dir fail a test.
            const exited = new Promise<void>((resolve) => proc.once("exit", () => resolve()));
            proc.kill("SIGKILL");
            await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
            try {
                rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
            } catch {
                /* a temp dir left behind is harmless */
            }
        },
    };
};
