import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./App.css";

const DEFAULT_GATEWAY =
  import.meta.env.VITE_GATEWAY_URL || "http://localhost:5047";
const DEFAULT_DOCUMENT_SERVICE =
  import.meta.env.VITE_DOCUMENT_SERVICE_URL || "http://localhost:5296";
const SESSION_KEY = "capfinloan.session";

const emptySession = {
  token: "",
  role: "",
  name: "",
  userId: "",
};

const emptyLoanForm = {
  applicantName: "",
  applicantEmail: "",
  phone: "",
  address: "",
  dateOfBirth: "1990-01-01",
  employerName: "",
  employmentType: "SALARIED",
  monthlyIncome: "",
  loanAmount: "",
  tenureMonths: "12",
  loanPurpose: "",
};

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function parseStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return emptySession;
    const parsed = JSON.parse(raw);
    return {
      token: parsed.token || "",
      role: parsed.role || "",
      name: parsed.name || "",
      userId: parsed.userId || "",
    };
  } catch {
    return emptySession;
  }
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeKeys(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeKeys);
  }

  if (value && typeof value === "object") {
    const next = {};
    Object.entries(value).forEach(([key, nested]) => {
      const normalizedKey = key
        ? `${key[0].toLowerCase()}${key.slice(1)}`
        : key;
      next[normalizedKey] = normalizeKeys(nested);
    });
    return next;
  }

  return value;
}

function unwrapData(payload) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }
  return payload;
}

async function apiRequest({
  gateway,
  path,
  method = "GET",
  token = "",
  body,
  isFormData = false,
}) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let requestBody;
  if (body !== undefined) {
    if (isFormData) {
      requestBody = body;
    } else {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }
  }

  const response = await fetch(`${gateway}${path}`, {
    method,
    headers,
    body: requestBody,
  });

  const text = await response.text();
  const payload = normalizeKeys(parseJsonSafe(text));
  const message = payload?.message || "";

  return {
    ok: response.ok,
    status: response.status,
    payload,
    data: unwrapData(payload),
    message,
    error: response.ok ? "" : message || "Request failed",
  };
}

function statusTone(value) {
  const status = String(value || "").toUpperCase();
  if (status.includes("APPROV")) return "approved";
  if (status.includes("REJECT")) return "rejected";
  if (status.includes("SUBMIT") || status.includes("REVIEW")) return "pending";
  return "draft";
}

function mapDecisionStatusToApplicationStatus(status) {
  const upper = String(status || "").toUpperCase();
  if (upper === "APPROVED") return "Approved";
  if (upper === "REJECTED") return "Rejected";
  if (upper === "PENDING") return "UnderReview";
  return "Submitted";
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function parseStatusNoteParts(statusNote) {
  const text = String(statusNote || "").trim();
  if (!text) {
    return { remark: "", sanctionTerms: "" };
  }

  const sanctionMarker = /sanction terms\s*:\s*/i;
  const markerIndex = text.search(sanctionMarker);

  if (markerIndex === -1) {
    return {
      remark: text.replace(/^remark\s*:\s*/i, "").trim(),
      sanctionTerms: "",
    };
  }

  const sanctionStart = text.match(sanctionMarker);
  const remarkSegment = text.slice(0, markerIndex).trim();
  const sanctionSegment = text
    .slice(markerIndex + (sanctionStart?.[0]?.length || 0))
    .trim();

  return {
    remark: remarkSegment
      .replace(/^remark\s*:\s*/i, "")
      .replace(/[|,;\-\s]+$/, "")
      .trim(),
    sanctionTerms: sanctionSegment,
  };
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  if (!rows?.length) return;
  const csv = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function HeaderBar({ gateway, setGateway, session, onLogout }) {
  const navigate = useNavigate();
  const role = normalizeRole(session.role);
  const isAdmin = role === "ADMIN";
  const isApplicant = role === "APPLICANT";



  return (
    <header className="topbar">
      <div className="brand">
        <p>CapFinLoan</p>
        <h1>Loan Workflow Portal</h1>
      </div>

      <div className="menu-spacer"></div>

      <div className="menu">
        {!session.token ? (
          <>
            <Link to="/login">Login</Link>
            <Link to="/signup">Signup</Link>
          </>
        ) : (
          <>
            {isAdmin ? <Link to="/admin">Admin Dashboard</Link> : null}
            <button type="button" className="ghost-btn" onClick={onLogout}>
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}

function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Secure Access</p>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}

function LoginPage({ gateway, onLogin }) {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const isLoginAsOther = searchParams.has("as-other");
  
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // If accessing with ?as-other cleared session to allow new login
  useEffect(() => {
    if (isLoginAsOther) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, [isLoginAsOther]);

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

function UserDashboard({ gateway, session }) {
  const [loanForm, setLoanForm] = useState(emptyLoanForm);
  const [editingApplicationId, setEditingApplicationId] = useState("");
  const [upload, setUpload] = useState({
    applicationId: "",
    documentType: "KYC",
    file: null,
  });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [applications, setApplications] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [statusInfo, setStatusInfo] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState("applications");

  const token = session.token;
  const selectedApplication = applications.find(
    (app) => String(app.id) === String(selectedId),
  );
  const selectedStatusParts = parseStatusNoteParts(
    selectedApplication?.statusNote,
  );
  const selectedAdminRemark =
    selectedStatusParts.remark || selectedApplication?.remarks || "-";
  const selectedSanctionTerms =
    selectedApplication?.sanctionTerms ||
    selectedApplication?.decision?.sanctionTerms ||
    selectedStatusParts.sanctionTerms ||
    "";

  const fetchApplications = async () => {
    const result = await apiRequest({
      gateway,
      path: "/gateway/applications/my",
      token,
    });

    if (!result.ok) {
      throw new Error(result.error || "Failed to load applications");
    }

    const list = Array.isArray(result.data) ? result.data : [];
    setApplications(list);

    if (!selectedId && list[0]?.id) {
      setSelectedId(String(list[0].id));
    }

    return list;
  };

  const fetchStatusAndDocs = async (applicationId) => {
    if (!applicationId) return;

    const [statusResult, docsResult] = await Promise.all([
      apiRequest({
        gateway,
        path: `/gateway/applications/${applicationId}/status`,
        token,
      }),
      apiRequest({
        gateway,
        path: `/gateway/documents/${applicationId}`,
        token,
      }),
    ]);

    if (statusResult.ok) {
      setStatusInfo(statusResult.data);
    }

    if (docsResult.ok) {
      setDocuments(Array.isArray(docsResult.data) ? docsResult.data : []);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    setError("");

    try {
      const list = await fetchApplications();
      const activeId = selectedId || String(list[0]?.id || "");
      if (activeId) {
        await fetchStatusAndDocs(activeId);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Refresh failed",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetchStatusAndDocs(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!autoRefresh) return undefined;

    const timer = setInterval(() => {
      refreshAll();
    }, 9000);

    return () => clearInterval(timer);
  }, [autoRefresh, selectedId]);

  const submitLoan = async (event) => {
    event.preventDefault();
    setNotice("");
    setError("");

    const body = {
      ...loanForm,
      monthlyIncome: Number(loanForm.monthlyIncome || 0),
      loanAmount: Number(loanForm.loanAmount || 0),
      tenureMonths: Number(loanForm.tenureMonths || 0),
    };

    setLoading(true);
    try {
      const isEditing = Boolean(editingApplicationId);
      const result = await apiRequest({
        gateway,
        path: isEditing
          ? `/gateway/applications/${editingApplicationId}`
          : "/gateway/applications",
        method: isEditing ? "PUT" : "POST",
        token,
        body,
      });

      if (!result.ok) {
        setError(
          result.error ||
            (isEditing
              ? "Could not update application."
              : "Could not create application."),
        );
        return;
      }

      setNotice(
        isEditing
          ? `Application ${editingApplicationId} updated successfully.`
          : "Loan application draft created successfully.",
      );
      setLoanForm(emptyLoanForm);
      setEditingApplicationId("");
      const id = isEditing
        ? String(editingApplicationId)
        : result.data?.id
          ? String(result.data.id)
          : "";
      if (id) {
        setSelectedId(id);
        setUpload((prev) => ({ ...prev, applicationId: id }));
      }
      await refreshAll();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Request failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const submitApplication = async (id) => {
    setNotice("");
    setError("");
    setLoading(true);

    try {
      const result = await apiRequest({
        gateway,
        path: `/gateway/applications/${id}/submit`,
        method: "POST",
        token,
      });

      if (!result.ok) {
        setError(result.error || "Submit action failed.");
        return;
      }

      setNotice(`Application ${id} submitted for review.`);
      await refreshAll();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Request failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (event) => {
    event.preventDefault();
    setNotice("");
    setError("");

    if (!upload.applicationId || !upload.file) {
      setError("Application and file are required for KYC upload.");
      return;
    }

    const formData = new FormData();
    formData.append("applicationId", String(upload.applicationId));
    formData.append("documentType", upload.documentType);
    formData.append("file", upload.file);

    setLoading(true);
    try {
      const result = await apiRequest({
        gateway,
        path: "/gateway/documents/upload",
        method: "POST",
        token,
        isFormData: true,
        body: formData,
      });

      if (!result.ok) {
        setError(result.error || "Document upload failed.");
        return;
      }

      setNotice("KYC document uploaded.");
      await fetchStatusAndDocs(upload.applicationId);
      setUpload((prev) => ({ ...prev, file: null }));
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Upload failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const startEditApplication = (app) => {
    setEditingApplicationId(String(app.id));
    setLoanForm({
      applicantName: app.applicantName || "",
      applicantEmail: app.applicantEmail || "",
      phone: app.phone || "",
      address: app.address || "",
      dateOfBirth: app.dateOfBirth
        ? new Date(app.dateOfBirth).toISOString().slice(0, 10)
        : "1990-01-01",
      employerName: app.employerName || "",
      employmentType: app.employmentType || "SALARIED",
      monthlyIncome:
        app.monthlyIncome === null || app.monthlyIncome === undefined
          ? ""
          : String(app.monthlyIncome),
      loanAmount:
        app.loanAmount === null || app.loanAmount === undefined
          ? ""
          : String(app.loanAmount),
      tenureMonths:
        app.tenureMonths === null || app.tenureMonths === undefined
          ? "12"
          : String(app.tenureMonths),
      loanPurpose: app.loanPurpose || "",
    });
  };

  const cancelEditApplication = () => {
    setEditingApplicationId("");
    setLoanForm(emptyLoanForm);
  };

  const deleteDocument = async (docId) => {
    setNotice("");
    setError("");
    setLoading(true);

    try {
      const result = await apiRequest({
        gateway,
        path: `/gateway/documents/${docId}`,
        method: "DELETE",
        token,
      });

      if (!result.ok) {
        setError(result.error || "Unable to delete document.");
        return;
      }

      setNotice(`Document ${docId} deleted.`);
      if (upload.applicationId) {
        await fetchStatusAndDocs(upload.applicationId);
      } else if (selectedId) {
        await fetchStatusAndDocs(selectedId);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Delete failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const previewSelectedFile = () => {
    if (!upload.file) {
      setError("Please select a file first.");
      return;
    }

    const url = URL.createObjectURL(upload.file);
    setPreviewUrl(url);
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  return (
    <main className="dashboard">
      <section className="dashboard-head">
        <div>
          <p className="eyebrow">Applicant</p>
          <h2>User Dashboard</h2>
          <p className="muted">
            Welcome, {session.name || "Applicant"}. Create loan application,
            upload KYC, and track live status updates.
          </p>
        </div>
      </section>

      {notice ? <p className="ok-text strip">{notice}</p> : null}
      {error ? <p className="error-text strip">{error}</p> : null}

      <section className="tab-nav">
        <button
          type="button"
          className={activeTab === "applications" ? "active" : ""}
          onClick={() => setActiveTab("applications")}
        >
          Applications
        </button>
        <button
          type="button"
          className={activeTab === "documents" ? "active" : ""}
          onClick={() => setActiveTab("documents")}
        >
          Documents
        </button>
        <button
          type="button"
          className={activeTab === "status" ? "active" : ""}
          onClick={() => setActiveTab("status")}
        >
          Status & Timeline
        </button>
      </section>

      {activeTab === "applications" && (
        <>
      <section className="grid-two">
        <article className="panel">
          <h3>
            {editingApplicationId ? "Edit Loan Application" : "Apply For Loan"}
          </h3>
          <form className="card-form" onSubmit={submitLoan}>
            <label>
              <span>Applicant Name</span>
              <input
                required
                value={loanForm.applicantName}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    applicantName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Applicant Email</span>
              <input
                required
                type="email"
                value={loanForm.applicantEmail}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    applicantEmail: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Phone</span>
              <input
                required
                value={loanForm.phone}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Address</span>
              <input
                required
                value={loanForm.address}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    address: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Date Of Birth</span>
              <input
                required
                type="date"
                value={loanForm.dateOfBirth}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    dateOfBirth: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Employer Name</span>
              <input
                required
                value={loanForm.employerName}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    employerName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Employment Type</span>
              <select
                value={loanForm.employmentType}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    employmentType: event.target.value,
                  }))
                }
              >
                <option value="SALARIED">SALARIED</option>
                <option value="SELF_EMPLOYED">SELF_EMPLOYED</option>
                <option value="CONTRACT">CONTRACT</option>
              </select>
            </label>
            <label>
              <span>Monthly Income</span>
              <input
                required
                type="number"
                min="1"
                value={loanForm.monthlyIncome}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    monthlyIncome: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Loan Amount</span>
              <input
                required
                type="number"
                min="1000"
                value={loanForm.loanAmount}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    loanAmount: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Tenure (Months)</span>
              <input
                required
                type="number"
                min="3"
                max="360"
                value={loanForm.tenureMonths}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    tenureMonths: event.target.value,
                  }))
                }
              />
            </label>
            <label className="full">
              <span>Loan Purpose</span>
              <input
                required
                maxLength={300}
                value={loanForm.loanPurpose}
                onChange={(event) =>
                  setLoanForm((prev) => ({
                    ...prev,
                    loanPurpose: event.target.value,
                  }))
                }
              />
            </label>
            <button type="submit" className="primary-btn" disabled={loading}>
              {editingApplicationId
                ? "Update Application"
                : "Create Application"}
            </button>
            {editingApplicationId ? (
              <button
                type="button"
                className="secondary-btn"
                onClick={cancelEditApplication}
                disabled={loading}
              >
                Cancel Edit
              </button>
            ) : null}
          </form>
        </article>
      </section>

      <section className="panel">
          <h3>My Loan Applications</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Id</th>
                <th>Amount</th>
                <th>Tenure</th>
                <th>Status</th>
                <th>Admin Remark</th>
                <th>Sanction Terms</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.length ? (
                applications.map((app) => {
                  const tone = statusTone(app.status);
                  const noteParts = parseStatusNoteParts(app.statusNote);
                  return (
                    <tr
                      key={app.id}
                      className={
                        String(app.id) === String(selectedId)
                          ? "active-row"
                          : ""
                      }
                    >
                      <td>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => {
                            const id = String(app.id);
                            setSelectedId(id);
                            setUpload((prev) => ({
                              ...prev,
                              applicationId: id,
                            }));
                          }}
                        >
                          #{app.id}
                        </button>
                      </td>
                      <td>{app.loanAmount}</td>
                      <td>{app.tenureMonths}</td>
                      <td>
                        <span className={`status ${tone}`}>{app.status}</span>
                      </td>
                      <td>{noteParts.remark || "-"}</td>
                      <td>{app.sanctionTerms || noteParts.sanctionTerms || "-"}</td>
                      <td>{new Date(app.updatedAt).toLocaleString()}</td>
                      <td>
                        <div className="action-row">
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => startEditApplication(app)}
                            disabled={
                              loading ||
                              String(app.status || "").toUpperCase() !== "DRAFT"
                            }
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => submitApplication(app.id)}
                            disabled={loading}
                          >
                            Submit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="muted-row">
                    No applications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h4>Application Details</h4>
        {selectedApplication ? (
          <div className="application-detail-card">
            <div className="application-detail-top">
              <div>
                <p className="eyebrow">Application #{selectedApplication.id}</p>
                <h3>{selectedApplication.loanPurpose || "Loan Application"}</h3>
              </div>
              <span className={`status ${statusTone(selectedApplication.status)}`}>
                {selectedApplication.status}
              </span>
            </div>

            <div className="detail-kpis">
              <article>
                <span>Loan Amount</span>
                <strong>{selectedApplication.loanAmount || "-"}</strong>
              </article>
              <article>
                <span>Tenure</span>
                <strong>{selectedApplication.tenureMonths || "-"} months</strong>
              </article>
              <article>
                <span>Monthly Income</span>
                <strong>{selectedApplication.monthlyIncome || "-"}</strong>
              </article>
            </div>

            <div className="detail-grid-two">
              <p><strong>Applicant Name</strong>{selectedApplication.applicantName || "-"}</p>
              <p><strong>Applicant Email</strong>{selectedApplication.applicantEmail || "-"}</p>
              <p><strong>Phone</strong>{selectedApplication.phone || "-"}</p>
              <p><strong>Address</strong>{selectedApplication.address || "-"}</p>
              <p><strong>Employer</strong>{selectedApplication.employerName || "-"}</p>
              <p><strong>Employment Type</strong>{selectedApplication.employmentType || "-"}</p>
            </div>

            <div className="detail-decision-card">
              <h4>Admin Decision</h4>
              <p>
                <strong>Remark:</strong> {selectedAdminRemark}
              </p>
              <p>
                <strong>Sanction Terms:</strong>{" "}
                {selectedSanctionTerms || "No sanction terms shared yet."}
              </p>
            </div>

            <div className="detail-meta-row">
              <p>
                <strong>Submitted At:</strong>{" "}
                {formatDateTime(selectedApplication.submittedAt)}
              </p>
              <p>
                <strong>Last Updated:</strong>{" "}
                {formatDateTime(selectedApplication.updatedAt)}
              </p>
            </div>
          </div>
        ) : (
          <p className="muted">
            Click an application id to view its full details.
          </p>
        )}
        </section>
      </>
      )}

      {activeTab === "documents" && (
        <section className="panel">
          <h3>Upload KYC Document</h3>
          <form className="card-form" onSubmit={uploadDocument}>
            <label>
              <span>Application</span>
              <select
                value={upload.applicationId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setUpload((prev) => ({ ...prev, applicationId: nextId }));
                  setSelectedId(nextId);
                }}
              >
                <option value="">Select application</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    #{app.id} - {app.status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Document Type</span>
              <input
                value={upload.documentType}
                onChange={(event) =>
                  setUpload((prev) => ({
                    ...prev,
                    documentType: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>File</span>
              <input
                type="file"
                onChange={(event) =>
                  setUpload((prev) => ({
                    ...prev,
                    file: event.target.files?.[0] || null,
                  }))
                }
              />
            </label>
            <div className="button-group">
              <button type="submit" className="primary-btn" disabled={loading}>
                Upload Document
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={previewSelectedFile}
                disabled={loading || !upload.file}
              >
                Preview File
              </button>
            </div>
          </form>

          {previewUrl ? (
            <div className="preview-modal-overlay" onClick={closePreview}>
              <div
                className="preview-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="preview-header">
                  <h3>Document Preview</h3>
                  <button
                    type="button"
                    className="close-btn"
                    onClick={closePreview}
                  >
                    ✕
                  </button>
                </div>
                <div className="preview-content">
                  {upload.file?.type.startsWith("image/") ? (
                    <img src={previewUrl} alt="Preview" />
                  ) : upload.file?.type === "application/pdf" ? (
                    <iframe src={previewUrl} type="application/pdf" />
                  ) : (
                    <p className="muted">
                      Preview not available for this file type. File:{" "}
                      {upload.file?.name}
                    </p>
                  )}
                </div>
                <div className="preview-footer">
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={closePreview}
                  >
                    Ready to Upload
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      closePreview();
                      setUpload((prev) => ({ ...prev, file: null }));
                    }}
                  >
                    Select Different File
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <h4>Uploaded Documents</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Type</th>
                  <th>File</th>
                  <th>Verified</th>
                  <th>Admin Remark</th>
                </tr>
              </thead>
              <tbody>
                {documents.length ? (
                  documents.map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.id}</td>
                      <td>{doc.documentType}</td>
                      <td>{doc.fileName}</td>
                      <td>{doc.isVerified ? "Yes" : "No"}</td>
                      <td>{doc.verificationRemarks || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="muted-row">
                      No documents yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "status" && (
        <section className="panel">
          <h4>Status Timeline</h4>
          {statusInfo?.currentRemark ? (
            <p className="muted">
              Latest Admin Remark: {statusInfo.currentRemark}
            </p>
          ) : null}
          <div className="timeline">
          {Array.isArray(statusInfo?.timeline) && statusInfo.timeline.length ? (
            statusInfo.timeline.map((item, index) => (
              <article
                key={`${item.status}-${index}`}
                className="timeline-item"
              >
                <p className="timeline-status">{item.status}</p>
                <p>{item.description}</p>
                <time>{new Date(item.date).toLocaleString()}</time>
              </article>
            ))
          ) : (
            <p className="muted">Select an application to see timeline.</p>
          )}
        </div>
      </section>
      )}
    </main>
  );
}

function AdminDashboard({ gateway, session }) {
  const [applications, setApplications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [docRemarks, setDocRemarks] = useState({});
  const [focusedId, setFocusedId] = useState("");
  const [decisionInfo, setDecisionInfo] = useState(null);
  const [applicationDetail, setApplicationDetail] = useState(null);
  const [applicationDocuments, setApplicationDocuments] = useState([]);
  const [verifyingDocId, setVerifyingDocId] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState("summary");

  const token = session.token;

  const reportRows = useMemo(() => {
    const headers = [
      "Application Id",
      "Applicant",
      "Email",
      "Loan Amount",
      "Tenure Months",
      "Application Status",
      "Decision",
      "Remarks",
      "Sanction Terms",
      "Last Updated",
    ];

    const body = applications.map((app) => {
      const draft = drafts[app.id] || {};
      return [
        app.id,
        app.applicantName || "",
        app.applicantEmail || "",
        app.loanAmount || "",
        app.tenureMonths || "",
        app.status || "",
        draft.status || "",
        draft.remarks || app.statusNote || "",
        draft.sanctionTerms || "",
        formatDateTime(app.updatedAt),
      ];
    });

    return [headers, ...body];
  }, [applications, drafts]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return users.filter((user) => {
      const role = String(user.role || "").toUpperCase();
      const roleMatch = userRoleFilter === "ALL" || role === userRoleFilter;
      if (!roleMatch) return false;
      if (!query) return true;
      const haystack = [user.name, user.email, user.phone, user.id]
        .map((item) => String(item || "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });
  }, [users, userRoleFilter, userSearch]);

  const loadUsers = async ({ silent = false } = {}) => {
    if (!silent) {
      setUsersLoading(true);
    }

    try {
      const usersResult = await apiRequest({
        gateway,
        path: "/gateway/admin/users",
        token,
      });

      if (!usersResult.ok) {
        throw new Error(usersResult.error || "Could not load users.");
      }

      setUsers(Array.isArray(usersResult.data) ? usersResult.data : []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load users.",
      );
    } finally {
      if (!silent) {
        setUsersLoading(false);
      }
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError("");

    try {
      const [appsResult, summaryResult, usersResult] = await Promise.all([
        apiRequest({ gateway, path: "/gateway/admin/applications", token }),
        apiRequest({ gateway, path: "/gateway/admin/reports/summary", token }),
        apiRequest({ gateway, path: "/gateway/admin/users", token }),
      ]);

      if (!appsResult.ok) {
        throw new Error(appsResult.error || "Could not load applications.");
      }

      setApplications(Array.isArray(appsResult.data) ? appsResult.data : []);
      if (summaryResult.ok) {
        setSummary(summaryResult.data);
      }

      if (usersResult.ok) {
        setUsers(Array.isArray(usersResult.data) ? usersResult.data : []);
      }

      if (focusedId) {
        await fetchApplicationContext(focusedId);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Refresh failed",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const fetchApplicationContext = async (applicationId) => {
    const [detailResult, docsResult] = await Promise.all([
      apiRequest({
        gateway,
        path: `/gateway/applications/${applicationId}`,
        token,
      }),
      apiRequest({
        gateway,
        path: `/gateway/documents/${applicationId}`,
        token,
      }),
    ]);

    if (detailResult.ok) {
      setApplicationDetail(detailResult.data);
    } else {
      setApplicationDetail(null);
    }

    if (docsResult.ok) {
      setApplicationDocuments(
        Array.isArray(docsResult.data) ? docsResult.data : [],
      );
    } else {
      setApplicationDocuments([]);
    }
  };

  const fetchDecision = async (applicationId) => {
    setFocusedId(String(applicationId));
    const [decisionResult] = await Promise.all([
      apiRequest({
        gateway,
        path: `/gateway/admin/decisions/application/${applicationId}`,
        token,
      }),
      fetchApplicationContext(applicationId),
    ]);

    if (decisionResult.ok) {
      setDecisionInfo(decisionResult.data);
    } else {
      setDecisionInfo(null);
    }
  };

  const submitDecision = async (applicationId) => {
    const draft = drafts[applicationId] || {
      status: "APPROVED",
      remarks: "",
      sanctionTerms: "",
    };

    setLoading(true);
    setNotice("");
    setError("");

    try {
      const result = await apiRequest({
        gateway,
        path: `/gateway/admin/applications/${applicationId}/decision`,
        method: "POST",
        token,
        body: draft,
      });

      if (!result.ok) {
        setError(result.error || "Decision submission failed.");
        return;
      }

      const statusSyncResult = await apiRequest({
        gateway,
        path: `/gateway/admin/applications/${applicationId}/status`,
        method: "PUT",
        token,
        body: {
          status: mapDecisionStatusToApplicationStatus(draft.status),
          statusNote: [
            draft.remarks ? `Remark: ${draft.remarks}` : "",
            draft.sanctionTerms ? `Sanction Terms: ${draft.sanctionTerms}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      });

      if (!statusSyncResult.ok) {
        setError(
          statusSyncResult.error ||
            "Decision saved but application status sync failed.",
        );
        await refresh();
        return;
      }

      setNotice(`Decision saved for application ${applicationId}.`);
      await refresh();
      await fetchDecision(applicationId);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Request failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const setDraft = (applicationId, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [applicationId]: {
        status: prev[applicationId]?.status || "APPROVED",
        remarks: prev[applicationId]?.remarks || "",
        sanctionTerms: prev[applicationId]?.sanctionTerms || "",
        ...patch,
      },
    }));
  };

  const previewDocument = async (docId) => {
    setError("");

    try {
      const endpoints = [
        `${gateway}/gateway/documents/${docId}/download`,
        `${DEFAULT_DOCUMENT_SERVICE}/api/document/${docId}/download`,
      ];

      let successfulResponse = null;
      let lastErrorMessage = "";

      for (const endpoint of endpoints) {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          successfulResponse = response;
          break;
        }

        const text = await response.text();
        const parsed = normalizeKeys(parseJsonSafe(text));
        lastErrorMessage =
          parsed?.message || `Preview request failed (${response.status}).`;
      }

      if (!successfulResponse) {
        setError(lastErrorMessage || "Unable to preview document.");
        return;
      }

      const blob = await successfulResponse.blob();
      const previewUrl = URL.createObjectURL(blob);
      window.open(previewUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(previewUrl), 60000);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Preview failed",
      );
    }
  };

  const verifyDocument = async (docId, isVerified) => {
    if (!focusedId) return;

    setLoading(true);
    setVerifyingDocId(String(docId));
    setNotice("");
    setError("");

    try {
      const result = await apiRequest({
        gateway,
        path: `/gateway/documents/${docId}/verify`,
        method: "PUT",
        token,
        body: {
          isVerified,
          remarks: docRemarks[docId] || "",
        },
      });

      if (!result.ok) {
        setError(result.error || "Document verification update failed.");
        return;
      }

      setNotice(
        `Document ${docId} marked as ${isVerified ? "verified" : "rejected"}.`,
      );
      await fetchApplicationContext(focusedId);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Request failed",
      );
    } finally {
      setVerifyingDocId("");
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId, isActive) => {
    setUpdatingUserId(String(userId));
    setNotice("");
    setError("");

    try {
      const result = await apiRequest({
        gateway,
        path: `/gateway/admin/users/${userId}/status`,
        method: "PUT",
        token,
        body: { isActive },
      });

      if (!result.ok) {
        setError(result.error || "Could not update user status.");
        return;
      }

      setNotice(
        `User ${userId} marked as ${isActive ? "active" : "inactive"}.`,
      );
      await loadUsers({ silent: true });
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Request failed",
      );
    } finally {
      setUpdatingUserId("");
    }
  };

  const exportApplicationsReport = () => {
    downloadCsv(`applications-report-${Date.now()}.csv`, reportRows);
    setNotice("Applications report downloaded.");
  };

  const exportUsersReport = () => {
    const rows = [
      ["User Id", "Name", "Email", "Phone", "Role", "Status"],
      ...filteredUsers.map((user) => [
        user.id,
        user.name,
        user.email,
        user.phone,
        user.role,
        user.isActive ? "Active" : "Inactive",
      ]),
    ];
    downloadCsv(`users-report-${Date.now()}.csv`, rows);
    setNotice("Users report downloaded.");
  };

  return (
    <main className="dashboard">
      <section className="dashboard-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Admin Dashboard</h2>
          <p className="muted">
            Welcome, {session.name || "Admin"}. Manage applications, decisions,
            reports, and users.
          </p>
        </div>
        <button
          type="button"
          className="secondary-btn"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      <div className="admin-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          Summary
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "decisions" ? "active" : ""}`}
          onClick={() => setActiveTab("decisions")}
        >
          Decision Management
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          Reports
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          User Management
        </button>
      </div>

      {notice ? <p className="ok-text strip">{notice}</p> : null}
      {error ? <p className="error-text strip">{error}</p> : null}

      {activeTab === "summary" && (
        <section className="tab-content">
          {summary ? (
            <section className="stats-row">
              <article className="stat-card">
                <p>Total Decisions</p>
                <strong>{summary.total ?? 0}</strong>
              </article>
              <article className="stat-card">
                <p>Approved</p>
                <strong>{summary.approved ?? 0}</strong>
              </article>
              <article className="stat-card">
                <p>Rejected</p>
                <strong>{summary.rejected ?? 0}</strong>
              </article>
            </section>
          ) : null}
          <section className="panel">
            <h3>Dashboard Overview</h3>
            <p className="muted">
              Use the tabs above to manage application decisions, generate
              reports, or administer user accounts. All changes are logged and
              tracked for compliance.
            </p>
          </section>
        </section>
      )}

      {activeTab === "decisions" && (
        <section className="tab-content">
          <section className="panel">
            <h3>All Applications</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Applicant</th>
                    <th>Email</th>
                    <th>Loan</th>
                    <th>Status</th>
                    <th>Decision</th>
                    <th>Remarks</th>
                    <th>Terms</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.length ? (
                    applications.map((app) => (
                      <tr
                        key={app.id}
                        className={
                          String(app.id) === focusedId ? "active-row" : ""
                        }
                      >
                        <td>
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => fetchDecision(app.id)}
                          >
                            #{app.id}
                          </button>
                        </td>
                        <td>{app.applicantName}</td>
                        <td>{app.applicantEmail}</td>
                        <td>{app.loanAmount}</td>
                        <td>
                          <span className={`status ${statusTone(app.status)}`}>
                            {app.status}
                          </span>
                        </td>
                        <td>
                          <select
                            value={drafts[app.id]?.status || "APPROVED"}
                            onChange={(event) =>
                              setDraft(app.id, { status: event.target.value })
                            }
                          >
                            <option value="APPROVED">APPROVED</option>
                            <option value="REJECTED">REJECTED</option>
                            <option value="PENDING">PENDING</option>
                          </select>
                        </td>
                        <td>
                          <input
                            placeholder="Reason"
                            value={drafts[app.id]?.remarks || ""}
                            onChange={(event) =>
                              setDraft(app.id, { remarks: event.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            placeholder="Sanction terms"
                            value={drafts[app.id]?.sanctionTerms || ""}
                            onChange={(event) =>
                              setDraft(app.id, {
                                sanctionTerms: event.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="primary-btn"
                            onClick={() => submitDecision(app.id)}
                            disabled={loading}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="muted-row">
                        No applications found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h3>Application Detail and KYC</h3>
            {applicationDetail ? (
              <div className="detail-grid">
                <div className="decision-card">
                  <p>
                    <strong>Application Id:</strong> {applicationDetail.id}
                  </p>
                  <p>
                    <strong>Applicant:</strong>{" "}
                    {applicationDetail.applicantName}
                  </p>
                  <p>
                    <strong>Email:</strong> {applicationDetail.applicantEmail}
                  </p>
                  <p>
                    <strong>Phone:</strong> {applicationDetail.phone}
                  </p>
                  <p>
                    <strong>Address:</strong> {applicationDetail.address}
                  </p>
                  <p>
                    <strong>Employer:</strong> {applicationDetail.employerName}
                  </p>
                  <p>
                    <strong>Employment:</strong>{" "}
                    {applicationDetail.employmentType}
                  </p>
                  <p>
                    <strong>Income:</strong> {applicationDetail.monthlyIncome}
                  </p>
                  <p>
                    <strong>Loan Amount:</strong> {applicationDetail.loanAmount}
                  </p>
                  <p>
                    <strong>Tenure:</strong> {applicationDetail.tenureMonths}
                  </p>
                  <p>
                    <strong>Loan Purpose:</strong>{" "}
                    {applicationDetail.loanPurpose || "-"}
                  </p>
                  <p>
                    <strong>Status:</strong> {applicationDetail.status}
                  </p>
                  <p>
                    <strong>Submitted At:</strong>{" "}
                    {applicationDetail.submittedAt
                      ? new Date(applicationDetail.submittedAt).toLocaleString()
                      : "-"}
                  </p>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Doc Id</th>
                        <th>Type</th>
                        <th>File</th>
                        <th>Verified</th>
                        <th>Remarks</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicationDocuments.length ? (
                        applicationDocuments.map((doc) => (
                          <tr key={doc.id}>
                            <td>{doc.id}</td>
                            <td>{doc.documentType}</td>
                            <td>{doc.fileName}</td>
                            <td>{doc.isVerified ? "Yes" : "No"}</td>
                            <td>
                              <input
                                className="mini-input"
                                placeholder="Verification remark"
                                value={
                                  docRemarks[doc.id] ||
                                  doc.verificationRemarks ||
                                  ""
                                }
                                onChange={(event) =>
                                  setDocRemarks((prev) => ({
                                    ...prev,
                                    [doc.id]: event.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td>
                              <div className="doc-actions">
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  disabled={
                                    loading && verifyingDocId === String(doc.id)
                                  }
                                  onClick={() => verifyDocument(doc.id, true)}
                                >
                                  Verify
                                </button>
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  disabled={
                                    loading && verifyingDocId === String(doc.id)
                                  }
                                  onClick={() => verifyDocument(doc.id, false)}
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  onClick={() => previewDocument(doc.id)}
                                >
                                  Preview
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="muted-row">
                            No KYC documents found for selected application.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="muted">
                Select an application id from the table to load full details and
                KYC documents.
              </p>
            )}
          </section>

          <section className="panel">
            <h3>Decision Detail</h3>
            {decisionInfo ? (
              <div className="decision-card">
                <p>
                  <strong>Application:</strong> {decisionInfo.applicationId}
                </p>
                <p>
                  <strong>Status:</strong> {decisionInfo.status}
                </p>
                <p>
                  <strong>Remarks:</strong> {decisionInfo.remarks || "-"}
                </p>
                <p>
                  <strong>Terms:</strong> {decisionInfo.sanctionTerms || "-"}
                </p>
                <p>
                  <strong>By:</strong> {decisionInfo.adminEmail || "-"}
                </p>
                <p>
                  <strong>Date:</strong>{" "}
                  {decisionInfo.decisionDate
                    ? new Date(decisionInfo.decisionDate).toLocaleString()
                    : "-"}
                </p>
              </div>
            ) : (
              <p className="muted">
                Select an application id to inspect current decision details.
              </p>
            )}
          </section>
        </section>
      )}

      {activeTab === "reports" && (
        <section className="tab-content">
          <section className="panel report-panel">
            <h3>Generate Reports</h3>
            <p className="muted">
              Export application decisions and user roster as CSV for audit and
              operations tracking.
            </p>
            <div className="action-row">
              <button
                type="button"
                className="secondary-btn"
                onClick={exportApplicationsReport}
                disabled={!applications.length}
              >
                Export Applications CSV
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={exportUsersReport}
                disabled={!filteredUsers.length}
              >
                Export Users CSV
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => loadUsers()}
                disabled={usersLoading}
              >
                {usersLoading ? "Refreshing Users..." : "Refresh Users"}
              </button>
            </div>
          </section>
        </section>
      )}

      {activeTab === "users" && (
        <section className="tab-content">
          <section className="panel">
            <h3>Manage Users</h3>
            <div className="users-toolbar">
              <label>
                <span>Search</span>
                <input
                  placeholder="Name, email, phone or id"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                />
              </label>
              <label>
                <span>Role</span>
                <select
                  value={userRoleFilter}
                  onChange={(event) => setUserRoleFilter(event.target.value)}
                >
                  <option value="ALL">ALL</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="APPLICANT">APPLICANT</option>
                </select>
              </label>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => loadUsers()}
                disabled={usersLoading}
              >
                {usersLoading ? "Loading..." : "Reload"}
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length ? (
                    filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>{user.name || "-"}</td>
                        <td>{user.email || "-"}</td>
                        <td>{user.phone || "-"}</td>
                        <td>{user.role || "-"}</td>
                        <td>
                          <span
                            className={`status ${
                              user.isActive ? "approved" : "rejected"
                            }`}
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="secondary-btn"
                            disabled={updatingUserId === String(user.id)}
                            onClick={() =>
                              toggleUserStatus(user.id, !Boolean(user.isActive))
                            }
                          >
                            {updatingUserId === String(user.id)
                              ? "Saving..."
                              : user.isActive
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="muted-row">
                        No users match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}
    </main>
  );
}

function Protected({ session, allowedRoles, children }) {
  const role = normalizeRole(session.role);
  if (!session.token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    return <Navigate to={role === "ADMIN" ? "/admin" : "/dashboard"} replace />;
  }

  return children;
}

function PublicOnly({ session, children }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isLoginAsOther = searchParams.has("as-other");
  
  if (!session.token) return children;
  if (isLoginAsOther) return children; // Allow login as different user
  
  const role = normalizeRole(session.role);
  return <Navigate to={role === "ADMIN" ? "/admin" : "/dashboard"} replace />;
}

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
