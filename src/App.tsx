import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { PhaseProvider } from './app/PhaseContext';
import { RoleProvider } from './app/RoleContext';
import { useAuth } from './app/AuthContext';
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
  // Sign-in is switched off: the app opens straight away as the TA Event Manager. The login screen (app/LoginPage) is kept for when it is needed again.
  return (
    <RoleProvider initialPersonaId={personaId ?? 'ta-manager'}>
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
