import { useState } from "react";

export interface UIStateManagementState {
    isLoading: boolean;
    setIsLoading: (value: boolean) => void;
}

export const useUIStateManagement = (): UIStateManagementState => {
    const [isLoading, setIsLoading] = useState(true);

    return {
        isLoading,
        setIsLoading,
    };
};
