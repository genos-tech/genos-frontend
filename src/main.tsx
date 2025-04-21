import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Route, Routes } from "react-router-dom"
import './index.css'
import App from './App.tsx'
import SignIn from './features/admin/components/signIn.tsx'
import SignUp from './features/admin/components/signUp.tsx'
import PageNotFound from './components/utils/pageNotFound.tsx'
import AuthGuard from './features/admin/authGuard.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import CreateTeam from './components/team/createTeam.tsx'
import SelectTeam from './components/team/selectTeam.tsx'

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <Router>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/SignUp" element={<SignUp />} />
        <Route path="/SignIn" element={<SignIn />} />
        <Route path="*" element={<PageNotFound />} />

        {/* Protected Routes */}
        <Route element={<AuthGuard />}>
          <Route path="/App" element={<App />} />
          <Route path="/CreateTeam" element={<CreateTeam />} />
          <Route path="/SelectTeam" element={<SelectTeam />} />
        </Route>
      </Routes>
    </Router>
  </AuthProvider>
)
