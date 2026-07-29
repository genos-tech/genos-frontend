import { useEffect, useState } from "react";
import { keyframes } from "@emotion/react";
import { Box, Button, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { useTranslation } from "../../../i18n";
import { loadInitialData } from "../../../services/loadInitialData";
import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";

type InitialLoadProps = {
    myself: UserProps;
    setIsLoading: (value: boolean) => void;
    setCurrentMainChat: (value: ChatProps) => void;
    // True once App's first background refresh (`refreshAllData`) has landed.
    // On a cold cache the boot gate waits for this before revealing the shell
    // so the first paint isn't empty; on a warm cache it's ignored.
    firstRefreshDone: boolean;
};

// Keyframe animations
const pulse = keyframes`
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.05); }
`;

const float = keyframes`
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
`;

const shimmer = keyframes`
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
`;

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
`;

const dotPulse = keyframes`
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
`;

export const InitialLoad = (props: InitialLoadProps) => {
    const { myself, setIsLoading, setCurrentMainChat, firstRefreshDone } = props;
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [showSignIn, setShowSignIn] = useState(false);
    // Offline changes what the slow-boot prompt should say. The default
    // copy blames the session ("may have expired — sign in again"), which
    // offline is both wrong and unactionable: the sign-in page can't
    // submit without a network either. Track connectivity so the prompt
    // can tell the truth instead.
    const [isOffline, setIsOffline] = useState<boolean>(
        typeof navigator !== "undefined" && navigator.onLine === false
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSignIn(true);
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const goOffline = () => setIsOffline(true);
        const goOnline = () => setIsOffline(false);
        window.addEventListener("offline", goOffline);
        window.addEventListener("online", goOnline);
        return () => {
            window.removeEventListener("offline", goOffline);
            window.removeEventListener("online", goOnline);
        };
    }, []);

    loadInitialData(myself, accessToken, setIsLoading, setCurrentMainChat, firstRefreshDone);

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                width: "100vw",
                background: `
                    radial-gradient(ellipse at 20% 80%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
                    radial-gradient(ellipse at 80% 20%, rgba(var(--gp-brand-500-rgb), 0.12) 0%, transparent 50%),
                    radial-gradient(ellipse at 50% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 70%),
                    linear-gradient(180deg, #0f0f14 0%, #1a1a24 50%, #12121a 100%)
                `,
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Subtle grid pattern overlay */}
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
                    `,
                    backgroundSize: "60px 60px",
                    opacity: 0.5,
                }}
            />

            {/* Animated glow orbs */}
            <Box
                sx={{
                    position: "absolute",
                    width: "300px",
                    height: "300px",
                    borderRadius: "50%",
                    background:
                        "radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)",
                    top: "10%",
                    left: "20%",
                    filter: "blur(40px)",
                    animation: `${pulse} 4s ease-in-out infinite`,
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    width: "250px",
                    height: "250px",
                    borderRadius: "50%",
                    background:
                        "radial-gradient(circle, rgba(var(--gp-brand-500-rgb), 0.15) 0%, transparent 70%)",
                    bottom: "15%",
                    right: "15%",
                    filter: "blur(50px)",
                    animation: `${pulse} 5s ease-in-out infinite 1s`,
                }}
            />

            {/* Main content container */}
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    zIndex: 1,
                    animation: `${float} 3s ease-in-out infinite`,
                }}
            >
                {/* Custom loader */}
                <Box
                    sx={{
                        display: "flex",
                        gap: "12px",
                        mb: 4,
                    }}
                >
                    {[0, 1, 2].map((i) => (
                        <Box
                            key={i}
                            sx={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "50%",
                                background:
                                    "linear-gradient(135deg, #6366f1 0%, var(--gp-brand-500) 100%)",
                                boxShadow: "0 0 20px rgba(99, 102, 241, 0.5)",
                                animation: `${dotPulse} 1.4s ease-in-out infinite`,
                                animationDelay: `${i * 0.16}s`,
                            }}
                        />
                    ))}
                </Box>

                {/* Loading text with shimmer effect */}
                <Typography
                    sx={{
                        fontSize: "1.1rem",
                        fontWeight: 500,
                        letterSpacing: "0.3em",
                        textTransform: "uppercase",
                        background:
                            "linear-gradient(90deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.5) 100%)",
                        backgroundSize: "200% 100%",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        animation: `${shimmer} 2s linear infinite`,
                    }}
                >
                    {t.common.initialLoad.loading}
                </Typography>

                {/* Subtle subtitle */}
                <Typography
                    sx={{
                        fontSize: "0.8rem",
                        color: "rgba(255,255,255,0.4)",
                        mt: 1.5,
                        fontWeight: 300,
                        letterSpacing: "0.1em",
                    }}
                >
                    {t.common.initialLoad.preparingWorkspace}
                </Typography>
            </Box>

            {/* Sign in prompt with smooth fade-in */}
            {showSignIn && (
                <Box
                    sx={{
                        position: "absolute",
                        bottom: "15%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        animation: `${fadeIn} 0.5s ease-out`,
                        zIndex: 1,
                    }}
                >
                    <Box
                        sx={{
                            width: "40px",
                            height: "1px",
                            background:
                                "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                            mb: 1,
                        }}
                    />
                    <Typography
                        sx={{
                            fontSize: "0.9rem",
                            color: "rgba(255,255,255,0.6)",
                            textAlign: "center",
                        }}
                    >
                        {isOffline
                            ? t.common.initialLoad.offlineTitle
                            : t.common.initialLoad.takingLonger}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: "0.8rem",
                            color: "rgba(255,255,255,0.4)",
                            mb: 1,
                            textAlign: "center",
                            maxWidth: 320,
                        }}
                    >
                        {isOffline
                            ? t.common.initialLoad.offlineBody
                            : t.common.initialLoad.sessionExpired}
                    </Typography>
                    {/* No button offline: sign-in can't submit without a
                        network, so offering it is a dead end. The `online`
                        listener swaps the prompt back the moment the
                        connection returns. */}
                    {!isOffline && (
                        <Button
                            variant="outlined"
                            sx={{
                                borderColor: "rgba(99, 102, 241, 0.5)",
                                color: "rgba(255,255,255,0.9)",
                                px: 4,
                                py: 1,
                                fontSize: "0.85rem",
                                fontWeight: 500,
                                letterSpacing: "0.05em",
                                borderRadius: "8px",
                                transition: "all 0.3s ease",
                                background: "rgba(99, 102, 241, 0.1)",
                                backdropFilter: "blur(10px)",
                                "&:hover": {
                                    borderColor: "rgba(99, 102, 241, 0.8)",
                                    background: "rgba(99, 102, 241, 0.2)",
                                    transform: "translateY(-2px)",
                                    boxShadow: "0 8px 25px rgba(99, 102, 241, 0.25)",
                                },
                            }}
                            onClick={() => navigate("/signin")}
                        >
                            {t.common.initialLoad.signInAgain}
                        </Button>
                    )}
                </Box>
            )}
        </Box>
    );
};
