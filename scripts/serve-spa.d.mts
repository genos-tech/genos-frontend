import type { Server } from "node:http";

export function routeKey(pathname: string): string | null;
export function pickPage(
    pages: Map<string, Buffer>,
    pathname: string,
    search: string
): Buffer | null;
export function createSpaServer(distDir: string): Server;
