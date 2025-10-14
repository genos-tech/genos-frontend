import { createRoot } from "react-dom/client";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";

import "./index.css";

import { AuthProvider } from "./context/AuthContext";
import { PageNotFound } from "./components/layout/pageNotFound";
import { AuthGuard } from "./features/admin/authGuard";
import { JoinTeam } from "./features/admin/components/joinTeamFrom";
import { SignInForm } from "./features/admin/components/SignInForm";
import { SignUpForm } from "./features/admin/components/SignUpForm";

import { App } from "./App";

createRoot(document.getElementById("root")!).render(
    <AuthProvider>
        <Router>
            <Routes>
                <Route path="/" element={<SignInForm />} />
                <Route path="/SignUp" element={<SignUpForm />} />
                <Route path="/SignIn" element={<SignInForm />} />
                <Route path="*" element={<PageNotFound />} />

                {/* Protected Routes */}
                <Route element={<AuthGuard />}>
                    <Route path="/App" element={<App />} />
                    <Route path="/JoinTeam" element={<JoinTeam />} />
                </Route>
            </Routes>
        </Router>
    </AuthProvider>
);
