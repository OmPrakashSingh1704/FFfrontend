import { type ComponentType, Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import './App.css'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PWAPrompts } from './components/PWAPrompts'
import { RouteLoader } from './components/RouteLoader'
import { AuthLayout } from './layouts/AuthLayout'
import { AppShell } from './layouts/AppShell'
import { useAuth } from './context/AuthContext'

type LazyComponent = ComponentType<Record<string, unknown>>

const lazyPage = <T extends Record<string, unknown>>(factory: () => Promise<T>, name: keyof T) =>
  lazy(async () => {
    const module = await factory()
    return { default: module[name] as LazyComponent }
  })

const LandingPage = lazyPage(() => import('./pages/LandingPage'), 'LandingPage')
const TermsPage = lazyPage(() => import('./pages/TermsPage'), 'TermsPage')
const PrivacyPage = lazyPage(() => import('./pages/PrivacyPage'), 'PrivacyPage')
const LoginPage = lazyPage(() => import('./pages/LoginPage'), 'LoginPage')
const SignupPage = lazyPage(() => import('./pages/SignupPage'), 'SignupPage')
// Public, SEO-indexable profile pages. Routed OUTSIDE the /app/* AppShell
// so they don't inherit the noindex meta and so they don't require auth.
const PublicFounderPage = lazyPage(() => import('./pages/PublicFounderPage'), 'PublicFounderPage')
const PublicInvestorPage = lazyPage(() => import('./pages/PublicInvestorPage'), 'PublicInvestorPage')
const PublicStartupPage = lazyPage(() => import('./pages/PublicStartupPage'), 'PublicStartupPage')
const Dashboard = lazyPage(() => import('./pages/Dashboard'), 'Dashboard')
const FoundersListPage = lazyPage(() => import('./pages/FoundersListPage'), 'FoundersListPage')
// FounderDetailPage retired — see /founders/:slugId via PublicFounderPage.
const UserRedirectPage = lazyPage(() => import('./pages/UserRedirectPage'), 'UserRedirectPage')
const StartupsListPage = lazyPage(() => import('./pages/StartupsListPage'), 'StartupsListPage')
// StartupDetailPage retired — see /startups/:slugId via PublicStartupPage.
const FeedPage = lazyPage(() => import('./pages/FeedPage'), 'FeedPage')
const IntrosPage = lazyPage(() => import('./pages/IntrosPage'), 'IntrosPage')
const TrustPage = lazyPage(() => import('./pages/TrustPage'), 'TrustPage')
const RespectPage = lazyPage(() => import('./pages/RespectPage'), 'RespectPage')
const NotificationsPage = lazyPage(() => import('./pages/NotificationsPage'), 'NotificationsPage')
const AnalyticsPage = lazyPage(() => import('./pages/AnalyticsPage'), 'AnalyticsPage')
const DesignGuidelinesPage = lazyPage(() => import('./pages/DesignGuidelinesPage'), 'DesignGuidelinesPage')
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
// InvestorDetailPage retired — see /investors/:slugId via PublicInvestorPage.
const FundsListPage = lazyPage(() => import('./pages/FundsListPage'), 'FundsListPage')
const FundDetailPage = lazyPage(() => import('./pages/FundDetailPage'), 'FundDetailPage')
const ApplicationsListPage = lazyPage(() => import('./pages/ApplicationsListPage'), 'ApplicationsListPage')
const ApplicationDetailPage = lazyPage(() => import('./pages/ApplicationDetailPage'), 'ApplicationDetailPage')
const MatchingPage = lazyPage(() => import('./pages/MatchingPage'), 'MatchingPage')
const DealsPage = lazyPage(() => import('./pages/DealsPage'), 'DealsPage')
const DealRoomDetailPage = lazyPage(() => import('./pages/DealRoomDetailPage'), 'DealRoomDetailPage')
const WorkflowSettingsPage = lazyPage(() => import('./pages/WorkflowSettingsPage'), 'WorkflowSettingsPage')
const VerificationPage = lazyPage(() => import('./pages/VerificationPage'), 'VerificationPage')
const UploadsPage = lazyPage(() => import('./pages/UploadsPage'), 'UploadsPage')
const ProfilePage = lazyPage(() => import('./pages/ProfilePage'), 'ProfilePage')
const FounderProfileEditPage = lazyPage(() => import('./pages/FounderProfileEditPage'), 'FounderProfileEditPage')
const InvestorProfileEditPage = lazyPage(() => import('./pages/InvestorProfileEditPage'), 'InvestorProfileEditPage')
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage')
const BillingPage = lazyPage(() => import('./pages/BillingPage'), 'BillingPage')
const InvitationsPage = lazyPage(() => import('./pages/InvitationsPage'), 'InvitationsPage')
const HelpPage = lazyPage(() => import('./pages/HelpPage'), 'HelpPage')
const VerifyEmailPage = lazyPage(() => import('./pages/VerifyEmailPage'), 'VerifyEmailPage')
const OnboardingPage = lazyPage(() => import('./pages/OnboardingPage'), 'OnboardingPage')
const ConnectionsPage = lazyPage(() => import('./pages/ConnectionsPage'), 'ConnectionsPage')
const NotFound = lazyPage(() => import('./pages/NotFound'), 'NotFound')

/**
 * Layout wrapper for routes that should look like a public page when the
 * visitor is logged out, and like an in-app page (with sidebar + header +
 * call widgets) when they're logged in.
 *
 * Profile pages are the canonical case: anon visitors see the clean
 * SEO-friendly view; authenticated users see the same content but inside
 * the AppShell so they can still navigate the rest of the product without
 * hitting the browser back button.
 */
function ConditionalAppShell() {
  const { status } = useAuth()
  return status === 'authenticated' ? <AppShell /> : <Outlet />
}

/**
 * Redirect old UUID-keyed profile URLs to the new <slug>-<short-uuid> pattern.
 *
 * The new unified detail pages accept a bare UUID at the end of the URL
 * just fine (parseSlugId handles it), so we just pass the id through as
 * the new slugId param. The page itself canonicalizes to the slug-prefixed
 * form once it has the data — which makes the final shareable URL pretty
 * without forcing the redirect to do a slug lookup here.
 */
function FounderRouteRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/founders/${id ?? ''}`} replace />
}
function InvestorRouteRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/investors/${id ?? ''}`} replace />
}
function StartupRouteRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/startups/${id ?? ''}`} replace />
}

function App() {
  return (
    <BrowserRouter>
      <PWAPrompts />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/design-guidelines" element={<DesignGuidelinesPage />} />

          {/* Profile pages — one URL per resource, served to both anon and
              signed-in viewers. URL pattern is <slug>-<short-uuid>. The
              slug part drives the public slug-keyed fetch; the short-uuid
              gives renaming permanence. Auth users see Connect/Chat
              affordances inline. See lib/slugId.ts.

              Wrapped in ConditionalAppShell so signed-in users keep the
              sidebar + nav while anon visitors get the clean SEO layout. */}
          <Route element={<ConditionalAppShell />}>
            <Route path="/founders/:slugId" element={<PublicFounderPage />} />
            <Route path="/investors/:slugId" element={<PublicInvestorPage />} />
            <Route path="/startups/:slugId" element={<PublicStartupPage />} />
          </Route>

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
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
            {/* Legacy: old /app/founders/<uuid> URLs. Bounce to the new
                pattern; the canonical slug form lands after the page loads. */}
            <Route path="/app/founders/:id" element={<FounderRouteRedirect />} />
            <Route
              path="/app/users/:id"
              element={
                <ProtectedRoute>
                  <UserRedirectPage />
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
            <Route path="/app/startups/:id" element={<StartupRouteRedirect />} />
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
              path="/app/connections"
              element={
                <ProtectedRoute>
                  <ConnectionsPage />
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
              path="/app/invitations"
              element={
                <ProtectedRoute>
                  <InvitationsPage />
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
            <Route path="/app/investors/:id" element={<InvestorRouteRedirect />} />
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
              path="/app/matching"
              element={
                <ProtectedRoute>
                  <MatchingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/deals/workflow-settings"
              element={
                <ProtectedRoute>
                  <WorkflowSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/deals/:id"
              element={
                <ProtectedRoute>
                  <DealRoomDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/deals"
              element={
                <ProtectedRoute>
                  <DealsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/verification"
              element={
                <ProtectedRoute>
                  <VerificationPage />
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
              path="/app/me"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            {/* Legacy: /app/profile → /app/me */}
            <Route path="/app/profile" element={<Navigate to="/app/me" replace />} />
            <Route
              path="/app/me/founder/edit"
              element={
                <ProtectedRoute>
                  <FounderProfileEditPage />
                </ProtectedRoute>
              }
            />
            <Route path="/app/profile/founder/edit" element={<Navigate to="/app/me/founder/edit" replace />} />
            <Route
              path="/app/me/investor/edit"
              element={
                <ProtectedRoute>
                  <InvestorProfileEditPage />
                </ProtectedRoute>
              }
            />
            <Route path="/app/profile/investor/edit" element={<Navigate to="/app/me/investor/edit" replace />} />
            <Route
              path="/app/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/billing"
              element={
                <ProtectedRoute>
                  <BillingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/help"
              element={
                <ProtectedRoute>
                  <HelpPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding/*"
              element={
                <ProtectedRoute allowOnboarding>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
