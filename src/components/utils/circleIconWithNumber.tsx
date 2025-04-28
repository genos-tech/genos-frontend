import React from "react";
import { Badge } from "@mui/joy";

interface CircleIconProps {
    number: number;
}
export const CircleIcon: React.FC<CircleIconProps> = ({ number }) => {
    return (
        <Badge
            variant="solid"
            size="lg"
            color="primary"
            badgeContent={number}
            sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
            }}
        />
    );
};
