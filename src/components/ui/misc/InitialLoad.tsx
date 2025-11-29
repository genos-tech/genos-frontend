import { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { loadInitialData } from "../../../services/loadInitialData";
import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";

type InitialLoadProps = {
    myself: UserProps;
    setIsLoading: (value: boolean) => void;
    setCurrentMainChat: (value: ChatProps) => void;
};

export const InitialLoad = (props: InitialLoadProps) => {
    const { myself, setIsLoading, setCurrentMainChat } = props;
    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const [showSignIn, setShowSignIn] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSignIn(true);
        }, 5000);

        return () => clearTimeout(timer); // cleanup when unmounted
    }, []);

    loadInitialData(myself, accessToken, setIsLoading, setCurrentMainChat);

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                width: "100vw",
                backgroundColor: "background.level1",
            }}
        >
            <CircularProgress size="lg" />
            <Typography level="h4" sx={{ mt: 2 }}>
                Loading...
            </Typography>
            {showSignIn && (
                <>
                    <Typography level="h4" sx={{ mt: 2 }}>
                        Your token might be already expired...
                    </Typography>
                    <Button
                        sx={{ mt: "10px" }}
                        variant="outlined"
                        onClick={() => {
                            navigate("/SignIn");
                        }}
                    >
                        Sign in Again
                    </Button>
                </>
            )}
        </Box>
    );
};
