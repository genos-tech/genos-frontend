import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { CircularProgress, Typography, Box, Button } from "@mui/joy";

import { loadInitialData } from "../../services/loadInitialData";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import { useAuth } from "../../context/AuthContext";

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
        }, 10000);

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
                        variant="outlined"
                        sx={{ mt: "10px" }}
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
