import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Route, Routes } from "react-router-dom"
import './index.css'
import App from './App.tsx'
import SignIn from './components/admin/signIn.tsx'
import SignUp from './components/admin/signUp.tsx'
import PageNotFound from './components/utils/pageNotFound.tsx'
import AuthGuard from './authGuard'
import ChatWindow from './tests/react_window_test.tsx'
import LoadTest from './tests/load_test.tsx'

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
      </Route>

      {/* testing pages */}
      <Route path="/testWindow" element={<ChatWindow />} />
      <Route path="/loadTest" element={<LoadTest />} />

    </Routes>
  </Router>
)
