import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { PhaseProvider } from './app/PhaseContext';
import { RoleProvider } from './app/RoleContext';
import { useAuth } from './app/AuthContext';
import { LoginPage } from './app/LoginPage';
import { TaProvider } from './app/TaContext';
import { ToastProvider } from './app/ToastContext';
import { AppRoutes } from './app/routes';

// Stand-in consoles for the client's SAP and Primavera P6, and the split view: separate "systems", no TURNPOINT chrome.
const SapConsole = lazy(() => import('./ext/SapConsole'));
const P6Console = lazy(() => import('./ext/P6Console'));
const SplitView = lazy(() => import('./ext/SplitView'));

function ExtPage({ path }: { path: string }) {
  const Page = path.startsWith('/ext/sap') ? SapConsole : path.startsWith('/ext/p6') ? P6Console : SplitView;
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}

function App() {
  const { pathname } = useLocation();
  const { personaId } = useAuth();
  if (pathname.startsWith('/ext/')) return <ExtPage path={pathname} />;
  // The login screen is shown at whatever URL was opened, so a deep link lands on its page after sign-in.
  if (!personaId) return <LoginPage />;
  return (
    <RoleProvider initialPersonaId={personaId}>
      <ToastProvider>
        <TaProvider>
          <PhaseProvider>
            <AppShell>
              <AppRoutes />
            </AppShell>
          </PhaseProvider>
        </TaProvider>
      </ToastProvider>
    </RoleProvider>
  );
}

export default App;
