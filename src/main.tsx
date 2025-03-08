import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Route, Routes } from "react-router-dom"
import './index.css'
import App from './App.tsx'
import SignIn from './components/admin/signIn.tsx'
import SignUp from './components/admin/signUp.tsx'
import PageNotFound from './components/utils/pageNotFound.tsx'
import AuthGuard from './authGuard'
import TaskHome from './components/taskHome.tsx'

createRoot(document.getElementById('root')!).render(
  <Router>
    <Routes>
      <Route path="/" element={<SignIn />} />
      <Route path="/SignUp" element={<SignUp />} />
      <Route path="/SignIn" element={<SignIn />} />
      <Route path="*" element={<PageNotFound />} />

      {/* Protected Routes */}
      <Route element={<AuthGuard />}>
        <Route path="/App" element={<App />} />
        <Route path="/TaskHome" element={<TaskHome />} />
      </Route>

    </Routes>
  </Router>
)
