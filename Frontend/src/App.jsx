import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import HeaderBar from "./components/HeaderBar";
import Protected from "./components/Protected";
import PublicOnly from "./components/PublicOnly";
import AdminDashboard from "./pages/AdminDashboard";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import UserDashboard from "./pages/UserDashboard";
import {
  DEFAULT_GATEWAY,
  SESSION_KEY,
  emptySession,
  normalizeRole,
  parseStoredSession,
} from "./utils/appUtils";
import "./App.css";

function AppShell() {
  const [gateway, setGateway] = useState(DEFAULT_GATEWAY);
  const [session, setSession] = useState(parseStoredSession());
  const [tokenValidated, setTokenValidated] = useState(false);
  const location = useLocation();

  const role = useMemo(() => normalizeRole(session.role), [session.role]);

  const onLogin = (nextSession) => {
    setSession(nextSession);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  };

  const onLogout = () => {
    setSession(emptySession);
    sessionStorage.removeItem(SESSION_KEY);
  };

  // Mark token as validated (no need to call backend on every load)
  useEffect(() => {
    setTokenValidated(true);
  }, []);

  // Listen for logout in other tabs
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === SESSION_KEY) {
        if (!event.newValue) {
          // Session was cleared in another tab
          setSession(emptySession);
        } else {
          // Session was updated in another tab, reload it
          try {
            const newSession = JSON.parse(event.newValue);
            setSession(newSession);
          } catch {
            setSession(emptySession);
          }
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const rootPath = role === "ADMIN" ? "/admin" : "/dashboard";
  const authRoute =
    location.pathname === "/login" || location.pathname === "/signup";

  // Show loading while validating token
  if (!tokenValidated) {
    return (
      <div className="app-root">
        <HeaderBar
          gateway={gateway}
          setGateway={setGateway}
          session={emptySession}
          onLogout={onLogout}
        />
        <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
          Validating session...
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <HeaderBar
        gateway={gateway}
        setGateway={setGateway}
        session={session}
        onLogout={onLogout}
      />
      <Routes>
        <Route
          path="/"
          element={
            <Navigate to={session.token ? rootPath : "/login"} replace />
          }
        />
        <Route
          path="/login"
          element={
            <PublicOnly session={session}>
              <LoginPage gateway={gateway} onLogin={onLogin} />
            </PublicOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnly session={session}>
              <SignupPage gateway={gateway} />
            </PublicOnly>
          }
        />
        <Route
          path="/dashboard"
          element={
            <Protected session={session} allowedRoles={["APPLICANT"]}>
              <UserDashboard gateway={gateway} session={session} />
            </Protected>
          }
        />
        <Route
          path="/admin"
          element={
            <Protected session={session} allowedRoles={["ADMIN"]}>
              <AdminDashboard gateway={gateway} session={session} />
            </Protected>
          }
        />
        <Route
          path="*"
          element={
            <Navigate to={session.token ? rootPath : "/login"} replace />
          }
        />
      </Routes>
      {!session.token && !authRoute ? (
        <p className="muted foot-note">Please login to continue.</p>
      ) : null}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
