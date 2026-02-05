import { type ComponentType, Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RouteLoader } from './components/RouteLoader'
import { AuthLayout } from './layouts/AuthLayout'
import { AppShell } from './layouts/AppShell'

type LazyComponent = ComponentType<Record<string, unknown>>

const lazyPage = <T extends Record<string, unknown>>(factory: () => Promise<T>, name: keyof T) =>
  lazy(async () => {
    const module = await factory()
    return { default: module[name] as LazyComponent }
  })

const LandingPage = lazyPage(() => import('./pages/LandingPage'), 'LandingPage')
const LoginPage = lazyPage(() => import('./pages/LoginPage'), 'LoginPage')
const SignupPage = lazyPage(() => import('./pages/SignupPage'), 'SignupPage')
const Dashboard = lazyPage(() => import('./pages/Dashboard'), 'Dashboard')
const FoundersListPage = lazyPage(() => import('./pages/FoundersListPage'), 'FoundersListPage')
const FounderDetailPage = lazyPage(() => import('./pages/FounderDetailPage'), 'FounderDetailPage')
const StartupsListPage = lazyPage(() => import('./pages/StartupsListPage'), 'StartupsListPage')
const StartupDetailPage = lazyPage(() => import('./pages/StartupDetailPage'), 'StartupDetailPage')
const FeedPage = lazyPage(() => import('./pages/FeedPage'), 'FeedPage')
const IntrosPage = lazyPage(() => import('./pages/IntrosPage'), 'IntrosPage')
const TrustPage = lazyPage(() => import('./pages/TrustPage'), 'TrustPage')
const RespectPage = lazyPage(() => import('./pages/RespectPage'), 'RespectPage')
const NotificationsPage = lazyPage(() => import('./pages/NotificationsPage'), 'NotificationsPage')
const AnalyticsPage = lazyPage(() => import('./pages/AnalyticsPage'), 'AnalyticsPage')
const AuditLogPage = lazyPage(() => import('./pages/AuditLogPage'), 'AuditLogPage')
const AdminPage = lazyPage(() => import('./pages/AdminPage'), 'AdminPage')
const AdminModerationPage = lazyPage(() => import('./pages/AdminModerationPage'), 'AdminModerationPage')
const AdminUserDetailPage = lazyPage(() => import('./pages/AdminUserDetailPage'), 'AdminUserDetailPage')
const AdminFundsPage = lazyPage(() => import('./pages/AdminFundsPage'), 'AdminFundsPage')
const AdminApplicationsPage = lazyPage(() => import('./pages/AdminApplicationsPage'), 'AdminApplicationsPage')
const ChatPage = lazyPage(() => import('./pages/ChatPage'), 'ChatPage')
const CallsPage = lazyPage(() => import('./pages/CallsPage'), 'CallsPage')
const SearchPage = lazyPage(() => import('./pages/SearchPage'), 'SearchPage')
const InvestorsListPage = lazyPage(() => import('./pages/InvestorsListPage'), 'InvestorsListPage')
const InvestorDetailPage = lazyPage(() => import('./pages/InvestorDetailPage'), 'InvestorDetailPage')
const FundsListPage = lazyPage(() => import('./pages/FundsListPage'), 'FundsListPage')
const FundDetailPage = lazyPage(() => import('./pages/FundDetailPage'), 'FundDetailPage')
const ApplicationsListPage = lazyPage(() => import('./pages/ApplicationsListPage'), 'ApplicationsListPage')
const ApplicationDetailPage = lazyPage(() => import('./pages/ApplicationDetailPage'), 'ApplicationDetailPage')
const UploadsPage = lazyPage(() => import('./pages/UploadsPage'), 'UploadsPage')
const OnboardingPage = lazyPage(() => import('./pages/OnboardingPage'), 'OnboardingPage')
const NotFound = lazyPage(() => import('./pages/NotFound'), 'NotFound')

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>

          <Route element={<AppShell />}>
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/founders"
              element={
                <ProtectedRoute>
                  <FoundersListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/founders/:id"
              element={
                <ProtectedRoute>
                  <FounderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/startups"
              element={
                <ProtectedRoute>
                  <StartupsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/startups/:id"
              element={
                <ProtectedRoute>
                  <StartupDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/feed"
              element={
                <ProtectedRoute>
                  <FeedPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/intros"
              element={
                <ProtectedRoute>
                  <IntrosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/trust"
              element={
                <ProtectedRoute>
                  <TrustPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/respect"
              element={
                <ProtectedRoute>
                  <RespectPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/audit"
              element={
                <ProtectedRoute>
                  <AuditLogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/admin/moderation"
              element={
                <ProtectedRoute>
                  <AdminModerationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/admin/users/:id"
              element={
                <ProtectedRoute>
                  <AdminUserDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/admin/funds"
              element={
                <ProtectedRoute>
                  <AdminFundsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/admin/applications"
              element={
                <ProtectedRoute>
                  <AdminApplicationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/chat/:id"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/calls"
              element={
                <ProtectedRoute>
                  <CallsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/search"
              element={
                <ProtectedRoute>
                  <SearchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/investors"
              element={
                <ProtectedRoute>
                  <InvestorsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/investors/:id"
              element={
                <ProtectedRoute>
                  <InvestorDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/funds"
              element={
                <ProtectedRoute>
                  <FundsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/funds/:id"
              element={
                <ProtectedRoute>
                  <FundDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/applications"
              element={
                <ProtectedRoute>
                  <ApplicationsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/applications/:id"
              element={
                <ProtectedRoute>
                  <ApplicationDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/uploads"
              element={
                <ProtectedRoute>
                  <UploadsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute allowOnboarding>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
          </Route>
          
          {/* Temporary test route */}
          <Route element={<AppShell />}>
            <Route path="/test-feed" element={<FeedPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
