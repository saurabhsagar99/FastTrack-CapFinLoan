// LoginPage handles user authentication.
// Submits credentials to the auth gateway endpoint and stores JWT + role info in session.
// Routes to the appropriate dashboard (admin vs applicant) based on role.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { SESSION_KEY, apiRequest, normalizeRole } from "../utils/appUtils";

function LoginPage({ gateway, onLogin }) {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const isLoginAsOther = searchParams.has("as-other");

  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Clear session if user is logging in as a different account.
  useEffect(() => {
    if (isLoginAsOther) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, [isLoginAsOther]);

  // Submits login credentials and routes to the user's dashboard on success.
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await apiRequest({
        gateway,
        path: "/gateway/auth/login",
        method: "POST",
        body: form,
      });

      if (!result.ok) {
        setError(result.error || "Unable to login.");
        return;
      }

      const auth = result.data || {};
      const nextSession = {
        token: auth.token || "",
        role: auth.role || "",
        name: auth.name || "",
        userId: auth.userId || "",
      };

      if (!nextSession.token) {
        setError("Login succeeded but token was missing in response.");
        return;
      }

      onLogin(nextSession);

      const role = normalizeRole(nextSession.role);
      navigate(role === "ADMIN" ? "/admin" : "/dashboard", { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Network error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Login" subtitle="Use your existing account to continue.">
      <form className="card-form" onSubmit={submit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            required
            value={form.email}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            required
            value={form.password}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? "Signing In..." : "Login"}
        </button>
      </form>
      <p className="inline-note">
        New user? <Link to="/signup">Create account</Link>
      </p>
    </AuthLayout>
  );
}

export default LoginPage;
