// Uptime probe for production, run from outside Railway by
// .github/workflows/uptime.yml every 10 minutes (MIP-772).
//
// Checks:
//   - genosai.dev, api, sockets and collab answer their health URLs;
//   - each one's TLS certificate has more than min(21 days, a quarter of
//     its lifetime) left: Railway renews Let's Encrypt's 90-day certs at
//     about 30 days, so a cert this close has missed its renewal;
//   - the genosai.dev registration has more than 30 days left (RDAP);
//   - genos-api's alert pipeline is alive: `api/v2/health/alerting/`,
//     with OPS_HEALTH_TOKEN, answers 503 when the ops-alert-tick cron has
//     stopped or can't send. That's the one thing the pipeline can't mail
//     about itself.
//
// Nothing here sends mail. GitHub mails the repo's watchers when a
// scheduled run fails, so a failed run is the alert. To keep that to one
// message an incident, the run fails only when a check STARTS failing:
// the failing set is kept between runs (actions/cache, under STATE_FILE),
// a check that keeps failing is logged but passes, and one that recovers
// is logged as resolved. The job summary always lists what's failing.
//
// This repo's Actions logs are public: the token is never printed, and a
// failure shows a status code or an error class, never a response body.

import fs from "node:fs";
import tls from "node:tls";

export const TARGETS = [
    { name: "frontend", url: "https://genosai.dev/" },
    { name: "api", url: "https://api.genosai.dev/api/v2/health/" },
    { name: "sockets", url: "https://app.genosai.dev/health" },
    { name: "collab", url: "https://backend-collab-production.up.railway.app/" },
];

export const DOMAIN = "genosai.dev";
export const RDAP_URL = `https://pubapi.registry.google/rdap/domain/${DOMAIN}`;
export const ALERTING_URL = "https://api.genosai.dev/api/v2/health/alerting/";

const DAY_MS = 24 * 60 * 60 * 1000;
export const CERT_WARN_MAX_DAYS = 21;
export const DOMAIN_WARN_DAYS = 30;
const TIMEOUT_MS = 15_000;
// One retry, a little later: a single dropped connection from a GitHub
// runner isn't an outage.
const RETRY_DELAY_MS = 20_000;

/** Days a certificate may have left before it counts as failing to renew. */
export function certWarnDays(validFrom, validTo) {
    const lifetimeDays = (validTo - validFrom) / DAY_MS;
    return Math.min(CERT_WARN_MAX_DAYS, lifetimeDays / 4);
}

/** A failure message for a certificate, or null when it's fine. */
export function judgeCert(name, validFrom, validTo, now) {
    const left = Math.floor((validTo - now) / DAY_MS);
    if (left < 0) return `${name}: TLS certificate expired on ${isoDay(validTo)}`;
    if (left <= certWarnDays(validFrom, validTo)) {
        return `${name}: TLS certificate expires in ${left} days (${isoDay(validTo)}), renewal looks stuck`;
    }
    return null;
}

/** A failure message for the domain registration, or null. */
export function judgeDomain(rdap, now) {
    const event = (rdap.events || []).find((e) => e.eventAction === "expiration");
    if (!event) return `domain: RDAP answer for ${DOMAIN} has no expiration date`;
    const expires = new Date(event.eventDate);
    const left = Math.floor((expires - now) / DAY_MS);
    if (left <= DOMAIN_WARN_DAYS) {
        return `domain: ${DOMAIN} registration expires in ${left} days (${isoDay(expires)})`;
    }
    return null;
}

/** A failure message for the alert pipeline's answer, or null. */
export function judgeAlerting(status, body) {
    if (status === 200) return null;
    if (status === 404) {
        return "alerting: health/alerting answered 404, so OPS_HEALTH_TOKEN differs between this repo and backend-django";
    }
    if (status === 503 && body && typeof body === "object") {
        const age = body.tick_age_seconds;
        const stuck = body.unsent_alerts;
        if (stuck) return `alerting: ${stuck} alert(s) unsent for over 15 minutes`;
        if (age === null || age === undefined)
            return "alerting: ops-alert-tick has never succeeded";
        return `alerting: ops-alert-tick last succeeded ${Math.round(age / 60)} min ago`;
    }
    return `alerting: health/alerting answered ${status}`;
}

/**
 * Compare this run's failures with the last run's. Returns what to report:
 * `opened` fail the run, `ongoing` are logged, `resolved` are logged.
 * Keyed by check, so a check whose message changes ("12 days" then "11")
 * stays one incident.
 */
export function diffIncidents(previous, failures) {
    const now = Object.fromEntries(failures.map((f) => [f.key, f.message]));
    const opened = failures.filter((f) => !(f.key in previous));
    const ongoing = failures.filter((f) => f.key in previous);
    const resolved = Object.keys(previous)
        .filter((key) => !(key in now))
        .map((key) => ({ key, message: previous[key] }));
    return { opened, ongoing, resolved, state: now };
}

function isoDay(date) {
    return new Date(date).toISOString().slice(0, 10);
}

/** What a failed fetch may say in a public log: the error class and code. */
export function describeError(error) {
    const cause = error && error.cause;
    const code = (cause && cause.code) || (error && error.code);
    const name = (error && error.name) || "Error";
    return code ? `${name} ${code}` : name;
}

async function fetchWithRetry(url, options = {}) {
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                redirect: "manual",
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            if (response.status < 500 || attempt === 2) return response;
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
            if (attempt === 2) throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
    throw lastError;
}

function peerCertificate(hostname) {
    return new Promise((resolve, reject) => {
        const socket = tls.connect({ host: hostname, port: 443, servername: hostname }, () => {
            const cert = socket.getPeerCertificate();
            socket.end();
            resolve({ validFrom: new Date(cert.valid_from), validTo: new Date(cert.valid_to) });
        });
        socket.setTimeout(TIMEOUT_MS, () => socket.destroy(new Error("TLS handshake timed out")));
        socket.on("error", reject);
    });
}

async function checkTarget(target, now) {
    const failures = [];
    try {
        const response = await fetchWithRetry(target.url);
        if (response.status !== 200) {
            failures.push({
                key: `up:${target.name}`,
                message: `${target.name}: ${target.url} answered ${response.status}`,
            });
        }
    } catch (error) {
        failures.push({
            key: `up:${target.name}`,
            message: `${target.name}: ${target.url} unreachable (${describeError(error)})`,
        });
    }
    // The handshake verifies the chain itself: a cert that no longer
    // verifies fails here, not just one near its date.
    try {
        const { validFrom, validTo } = await peerCertificate(new URL(target.url).hostname);
        const message = judgeCert(target.name, validFrom, validTo, now);
        if (message) failures.push({ key: `cert:${target.name}`, message });
    } catch (error) {
        failures.push({
            key: `cert:${target.name}`,
            message: `${target.name}: TLS handshake failed (${describeError(error)})`,
        });
    }
    return failures;
}

async function checkDomain(now) {
    try {
        const response = await fetchWithRetry(RDAP_URL, {
            headers: { Accept: "application/rdap+json" },
        });
        if (response.status !== 200) {
            return [{ key: "domain", message: `domain: RDAP answered ${response.status}` }];
        }
        const message = judgeDomain(await response.json(), now);
        return message ? [{ key: "domain", message }] : [];
    } catch (error) {
        return [{ key: "domain", message: `domain: RDAP unreachable (${describeError(error)})` }];
    }
}

async function checkAlerting(token) {
    if (!token) {
        // Logged every run, but not an incident: an unset secret can't page.
        console.log("::warning::OPS_HEALTH_TOKEN is not set; the alert pipeline is not checked.");
        return [];
    }
    try {
        const response = await fetchWithRetry(ALERTING_URL, {
            headers: { Authorization: `Bearer ${token}` },
        });
        let body = null;
        try {
            body = await response.json();
        } catch {
            body = null;
        }
        const message = judgeAlerting(response.status, body);
        return message ? [{ key: "alerting", message }] : [];
    } catch (error) {
        return [
            {
                key: "alerting",
                message: `alerting: health/alerting unreachable (${describeError(error)})`,
            },
        ];
    }
}

function readState(file) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8")).failing || {};
    } catch {
        return {};
    }
}

function writeSummary(lines) {
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (file) fs.appendFileSync(file, lines.join("\n") + "\n");
}

export async function main() {
    const now = new Date();
    const stateFile = process.env.STATE_FILE || ".uptime-state.json";
    const previous = readState(stateFile);

    const results = await Promise.all([
        ...TARGETS.map((target) => checkTarget(target, now)),
        checkDomain(now),
        checkAlerting(process.env.OPS_HEALTH_TOKEN || ""),
    ]);
    const failures = results.flat();
    const { opened, ongoing, resolved, state } = diffIncidents(previous, failures);

    fs.writeFileSync(stateFile, JSON.stringify({ failing: state }));
    // The workflow saves the state only when it changed: a cache entry per
    // run would be 144 a day of the same "{}".
    if (process.env.GITHUB_OUTPUT) {
        const changed = opened.length > 0 || resolved.length > 0;
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
    }

    for (const f of resolved) console.log(`Resolved: ${f.message}`);
    for (const f of ongoing) console.log(`::warning::Still failing: ${f.message}`);
    for (const f of opened) console.log(`::error::${f.message}`);

    const summary = ["## Uptime", ""];
    if (!failures.length) summary.push("All checks passed.");
    for (const f of opened) summary.push(`- **New:** ${f.message}`);
    for (const f of ongoing) summary.push(`- Still failing: ${f.message}`);
    for (const f of resolved) summary.push(`- Resolved: ${f.message}`);
    summary.push("", "Runbook: genos-docs `operations/ALERTS.md`, section *Uptime*.");
    writeSummary(summary);

    if (opened.length) {
        console.log(
            `${opened.length} new failure(s). Runbook: genos-docs operations/ALERTS.md#uptime`
        );
        process.exitCode = 1;
    } else {
        console.log(
            failures.length
                ? `${failures.length} known failure(s), none new.`
                : "All checks passed."
        );
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await main();
}
