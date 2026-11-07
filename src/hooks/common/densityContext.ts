import { createContext, useContext } from "react";

import { DEFAULT_DENSITY, Density } from "../../theme/density";

/** Context + hook for the row-density preference. Kept apart from the
 *  provider component so that file exports only a component (fast refresh). */

export interface DensityPreferenceContextValue {
    density: Density;
    setDensity: (d: Density) => void;
}

export const DensityPreferenceContext = createContext<DensityPreferenceContextValue | null>(null);

export const useDensityPreference = (): DensityPreferenceContextValue => {
    const ctx = useContext(DensityPreferenceContext);
    if (!ctx) return { density: DEFAULT_DENSITY, setDensity: () => {} };
    return ctx;
};
