import { useEffect } from "react";

import {
    reportServiceActive,
    reportServiceInactive,
    SwitchService,
} from "../../services/serviceSwitch/serviceSwitchStore";

type ServiceSwitchReadyProps = {
    service: SwitchService;
    /** True while this service's Home is the one being shown. */
    active: boolean;
};

/**
 * Renders nothing. Mounted inside each Home's `Suspense`, next to the Home, it
 * tells the service-switch store (MIP-965) when that Home is active and
 * committed, so the "Loading data…" page can hide one frame later.
 *
 * Why it sits INSIDE the `Suspense`: on the first visit the Home is a lazy
 * chunk. While it loads, the boundary shows its fallback and does not commit
 * its children, so this effect cannot run until the real Home has mounted.
 *
 * It only WRITES to the store (an effect, after the commit); it never
 * subscribes, so it adds no render to the Home it sits in. When a Home stops
 * being the active one the cleanup reports that too, which keeps "what is on
 * screen" correct for the next click.
 */
export const ServiceSwitchReady = ({ service, active }: ServiceSwitchReadyProps) => {
    useEffect(() => {
        if (!active) return;
        reportServiceActive(service);
        return () => reportServiceInactive(service);
    }, [active, service]);
    return null;
};
