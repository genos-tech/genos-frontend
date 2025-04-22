import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Route, Routes } from "react-router-dom"
import './index.css'
import App from './App'
import { SignInForm } from './features/admin/components/SignInForm'
import { SignUpForm } from './features/admin/components/SignUpForm'
import { PageNotFound } from './components/layout/pageNotFound'
import { AuthGuard } from './features/admin/authGuard'
import { AuthProvider } from './context/AuthContext'
import { JoinTeam } from './features/admin/components/joinTeamFrom'

createRoot(document.getElementById('root')!).render(
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
)
