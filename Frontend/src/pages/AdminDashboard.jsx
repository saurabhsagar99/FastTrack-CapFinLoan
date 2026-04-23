import { useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  downloadCsv,
  formatDateTime,
  mapDecisionStatusToApplicationStatus,
  normalizeKeys,
  parseJsonSafe,
  statusTone,
} from "../utils/appUtils";

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
  const [decisionStep, setDecisionStep] = useState("summary");

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

  const refresh = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
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
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!focusedId || activeTab !== "decisions") return undefined;

    const timer = setInterval(() => {
      fetchApplicationContext(focusedId);
    }, 9000);

    return () => clearInterval(timer);
  }, [activeTab, focusedId]);

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
    setDecisionStep("summary");
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

      setDraft(applicationId, {
        status: decisionResult.data.status?.toUpperCase() || "PENDING",
        remarks: decisionResult.data.remarks || "",
        sanctionTerms: decisionResult.data.sanctionTerms || "",
      });
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

  const isDocumentReviewed = (doc) => {
    const value = doc?.isVerified;
    return value !== null && value !== undefined && value !== "";
  };

  const isDocumentVerified = (doc) => {
    const value = doc?.isVerified;
    return (
      value === true ||
      value === 1 ||
      String(value).toLowerCase() === "true"
    );
  };

  const getVerificationLabel = (doc) => {
    if (!isDocumentReviewed(doc)) {
      return "Pending";
    }
    return isDocumentVerified(doc) ? "Yes" : "No";
  };

  const areAllDocumentsReviewed = () => {
    if (!applicationDocuments || applicationDocuments.length === 0) {
      return false;
    }
    return applicationDocuments.every((doc) => isDocumentReviewed(doc));
  };

  const previewDocument = async (docId) => {
    setError("");

    try {
      const response = await fetch(
        `${gateway}/gateway/documents/${docId}/download`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const text = await response.text();
        const parsed = normalizeKeys(parseJsonSafe(text));
        setError(
          parsed?.message || `Preview request failed (${response.status}).`,
        );
        return;
      }

      const blob = await response.blob();
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
          <p className="muted">
            Welcome, {session.name || "Admin"}. Manage applications, decisions,
            reports, and users.
          </p>
        </div>
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
                    <th>Applicant</th>
                    <th>Email</th>
                    <th>Loan</th>
                    <th>Status</th>
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
                        <td>{app.applicantName}</td>
                        <td>{app.applicantEmail}</td>
                        <td>{app.loanAmount}</td>
                        <td>
                          <span className={`status ${statusTone(app.status)}`}>
                            {app.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => fetchDecision(app.id)}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="muted-row">
                        No applications found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h3>Application Detail</h3>
            {applicationDetail ? (
              <div className="detail-section">
                {decisionStep === "summary" && (
                  <>
                    <div className="summary-grid">
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
                      </div>
                      
                      <div className="decision-card">
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
                    </div>
                    <div className="action-footer">
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => setDecisionStep("verification")}
                        disabled={!applicationDocuments.length}
                      >
                        Start Verification
                      </button>
                    </div>
                  </>
                )}

                {decisionStep === "verification" && (
                  <div className="verification-section">
                    <h4>Step 1: Document Verification</h4>
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
                                <td>{getVerificationLabel(doc)}</td>
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

                  <div className="verification-complete-section">
                    <p className="section-hint">
                      Review and verify all documents to proceed to final decision.
                    </p>
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => setDecisionStep("final")}
                      disabled={loading || !areAllDocumentsReviewed()}
                    >
                      Continue
                    </button>
                  </div>
                  </div>
                )}

                {decisionStep === "final" && (
                  <>
                    <div className="verification-complete-section">
                      <p className="section-hint">
                        Document verification complete. Proceed with final decision.
                      </p>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => setDecisionStep("verification")}
                      >
                        Back to Verification
                      </button>
                    </div>
                  <div className="decision-form-card">
                    <h4>Final Decision</h4>
                    <p className="section-hint">
                      Step 2: Complete the final decision based on your document review.
                    </p>
                    <label>
                      <span>Status</span>
                      <select
                        value={
                          drafts[applicationDetail.id]?.status || "PENDING"
                        }
                        onChange={(event) =>
                          setDraft(applicationDetail.id, {
                            status: event.target.value,
                          })
                        }
                      >
                        <option value="APPROVED">APPROVED</option>
                        <option value="REJECTED">REJECTED</option>
                        <option value="PENDING">PENDING</option>
                      </select>
                    </label>
                    <label>
                      <span>Remarks</span>
                      <textarea
                        rows={3}
                        placeholder="Enter remarks for the decision"
                        value={
                          drafts[applicationDetail.id]?.remarks || ""
                        }
                        onChange={(event) =>
                          setDraft(applicationDetail.id, {
                            remarks: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>Sanction Terms</span>
                      <textarea
                        rows={3}
                        placeholder="Enter sanction terms"
                        value={
                          drafts[applicationDetail.id]?.sanctionTerms || ""
                        }
                        onChange={(event) =>
                          setDraft(applicationDetail.id, {
                            sanctionTerms: event.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="decision-actions">
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => submitDecision(applicationDetail.id)}
                        disabled={loading}
                      >
                        Save Final Decision
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => setDecisionStep("verification")}
                      >
                        Back to Document Review
                      </button>
                    </div>
                  </div>
                  </>
                )}
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

export default AdminDashboard;
