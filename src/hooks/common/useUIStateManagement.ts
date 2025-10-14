import { useState, useEffect } from "react";

export interface UIStateManagementState {
    isLoading: boolean;
    setIsLoading: (value: boolean) => void;
    openingService: number;
    setOpeningService: (value: number) => void;
}

export const useUIStateManagement = (): UIStateManagementState => {
    const [isLoading, setIsLoading] = useState(true);

    // openingService = {0: Inbox, 1: Chat, 2: Tasks, 3: Notes}
    const [openingService, setOpeningService] = useState<number>(
        Number(localStorage.getItem("openingService") || "1")
    );

    useEffect(() => {
        localStorage.setItem("openingService", openingService.toString());
    }, [openingService]);

    return {
        isLoading,
        setIsLoading,
        openingService,
        setOpeningService,
    };
};
