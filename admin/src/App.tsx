import { Loader2 } from 'lucide-react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './state/auth.js';
import { AppShell } from './components/AppShell.js';
import { LoginPage } from './pages/LoginPage.js';
import { PaymentsPendingPage } from './pages/PaymentsPendingPage.js';
import { PaymentsHistoryPage } from './pages/PaymentsHistoryPage.js';
import { PaymentDetailPage } from './pages/PaymentDetailPage.js';
import { UsersListPage } from './pages/UsersListPage.js';
import { UserDetailPage } from './pages/UserDetailPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { OperatorsPage } from './pages/OperatorsPage.js';
import { AccountPage } from './pages/AccountPage.js';

const RequireAuth = () => {
  const { state } = useAuth();
  const location = useLocation();

  if (state.kind === 'idle' || state.kind === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (state.kind === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

const RequireSuperadmin = () => {
  const { state } = useAuth();
  if (state.kind !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }
  if (state.admin.role !== 'superadmin') {
    return (
      <div className="rounded-xl bg-amber-50 p-6 text-sm text-amber-800">
        <strong>Forbidden.</strong> This page requires superadmin privileges.
      </div>
    );
  }
  return <Outlet />;
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route
              path="/"
              element={<Navigate to="/payments/pending" replace />}
            />
            <Route
              path="/payments/pending"
              element={<PaymentsPendingPage />}
            />
            <Route
              path="/payments/history"
              element={<PaymentsHistoryPage />}
            />
            <Route path="/payments/:id" element={<PaymentDetailPage />} />
            <Route path="/users" element={<UsersListPage />} />
            <Route path="/users/:id" element={<UserDetailPage />} />
            <Route path="/account" element={<AccountPage />} />

            <Route element={<RequireSuperadmin />}>
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/operators" element={<OperatorsPage />} />
            </Route>

            <Route
              path="*"
              element={
                <div className="rounded-xl bg-white p-6 text-sm text-slate-600 shadow-sm">
                  Page not found.
                </div>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
