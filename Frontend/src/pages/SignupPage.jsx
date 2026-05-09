// SignupPage handles new applicant registration.
// Validates form inputs and creates an account via the auth gateway endpoint.
// Routes to login page on successful registration.

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { apiRequest } from "../utils/appUtils";

function SignupPage({ gateway }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Submits the signup form to create a new applicant account.
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await apiRequest({
        gateway,
        path: "/gateway/auth/signup",
        method: "POST",
        body: form,
      });

      if (!result.ok) {
        setError(result.error || "Could not create account.");
        return;
      }

      setSuccess("Signup successful. Redirecting to login...");
      setTimeout(() => navigate("/login", { replace: true }), 1000);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Network error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Signup"
      subtitle="Create an applicant account for loan requests."
    >
      <form className="card-form" onSubmit={submit}>
        <label>
          <span>Full Name</span>
          <input
            type="text"
            required
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
          />
        </label>
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
          <span>Phone</span>
          <input
            type="text"
            required
            value={form.phone}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, phone: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            minLength={8}
            required
            value={form.password}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        {success ? <p className="ok-text">{success}</p> : null}
        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? "Creating..." : "Create Account"}
        </button>
      </form>
      <p className="inline-note">
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </AuthLayout>
  );
}

export default SignupPage;
