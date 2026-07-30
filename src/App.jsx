import { lazy, Suspense } from 'react'
import { Routes, Route, Outlet, Link } from 'react-router-dom'
import { SafetyProvider } from './context/SafetyContext'
import { VoiceSOSProvider } from './context/VoiceSOSContext'
import ProtectedRoute from './components/ProtectedRoute'
import NavBar from './components/NavBar'
import PushToast from './components/PushToast'
// Home loads eagerly since it's the first thing almost everyone sees.
// Everything else is code-split so the initial bundle (leaflet, firebase,
// etc. only pull in what a given page actually needs) stays small.
import Home from './pages/Home'
const Alerts = lazy(() => import('./pages/Alerts'))
const SafeRoutes = lazy(() => import('./pages/SafeRoutes'))
const NearbyPlaces = lazy(() => import('./pages/NearbyPlaces'))
const CheckIn = lazy(() => import('./pages/CheckIn'))
const Community = lazy(() => import('./pages/Community'))
const VoiceSOS = lazy(() => import('./pages/VoiceSOS'))
const Contacts = lazy(() => import('./pages/Contacts'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--moss)]" />
    </div>
  )
}

function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <NavBar />
      <PushToast />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--line)] px-5 py-6 text-center text-xs text-[var(--ink-soft)]">
        SafeCircle — built to help you move through your city with confidence.
      </footer>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-24 text-center">
      <h1 className="text-4xl font-semibold">404</h1>
      <p className="text-sm text-[var(--ink-soft)]">This page doesn't exist.</p>
      <Link to="/" className="mt-2 rounded-lg bg-[var(--moss)] px-4 py-2 text-sm font-semibold text-white">Back home</Link>
    </div>
  )
}

function App() {
  return (
    <SafetyProvider>
      <VoiceSOSProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<Layout />}>
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Home />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/routes" element={<SafeRoutes />} />
                <Route path="/nearby" element={<NearbyPlaces />} />
                <Route path="/checkin" element={<CheckIn />} />
                <Route path="/community" element={<Community />} />
                <Route path="/voice" element={<VoiceSOS />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </VoiceSOSProvider>
    </SafetyProvider>
  )
}

export default App
