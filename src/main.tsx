import "./index.css";

import { createRoot } from "react-dom/client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

import { App } from "./App";
import { PageNotFound } from "./components/layout/pageNotFound";
import { AuthProvider } from "./context/AuthContext";
import { AuthGuard } from "./features/admin/authGuard";
import { JoinTeam } from "./features/admin/components/joinTeamFrom";
import { SignInForm } from "./features/admin/components/SignInForm";
import { SignUpForm } from "./features/admin/components/SignUpForm";

createRoot(document.getElementById("root")!).render(
    <AuthProvider>
        <Router>
            <Routes>
                <Route element={<SignInForm />} path="/" />
                <Route element={<SignUpForm />} path="/SignUp" />
                <Route element={<SignInForm />} path="/SignIn" />
                <Route element={<PageNotFound />} path="*" />

                {/* Protected Routes */}
                <Route element={<AuthGuard />}>
                    <Route element={<App />} path="/App" />
                    <Route element={<JoinTeam />} path="/JoinTeam" />
                </Route>
            </Routes>
        </Router>
    </AuthProvider>
);
