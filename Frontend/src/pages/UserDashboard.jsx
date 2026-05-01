import { useEffect, useState } from "react";
import {
  apiRequest,
  emptyLoanForm,
  formatDateTime,
  parseStatusNoteParts,
  statusTone,
} from "../utils/appUtils";
import DocumentChecklist from "../components/DocumentChecklist";
import ChatbotPanel from "../components/ChatbotPanel";

function UserDashboard({ gateway, session }) {
  const [loanForm, setLoanForm] = useState(emptyLoanForm);
  const [editingApplicationId, setEditingApplicationId] = useState("");
  const [draftApplicationId, setDraftApplicationId] = useState("");
  const [applications, setApplications] = useState([]);
  const [statusInfo, setStatusInfo] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState("apply");
  const [allDocumentsUploaded, setAllDocumentsUploaded] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [chatOpen, setChatOpen] = useState(false);
  const [dobYear, setDobYear] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobDay, setDobDay] = useState("");

  const token = session.token;
  const [showDecisionDetails, setShowDecisionDetails] = useState(false);

  const selectedApplication = applications.find(
    (app) => String(app.id) === String(selectedId),
  );
  const selectedStatusParts = parseStatusNoteParts(
    selectedApplication?.statusNote,
  );
  const selectedAdminRemark = selectedStatusParts.remark || "-";
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

  const fetchStatus = async (applicationId) => {
    if (!applicationId) return;

    const statusResult = await apiRequest({
      gateway,
      path: `/gateway/applications/${applicationId}/status`,
      token,
    });

    if (statusResult.ok) {
      setStatusInfo(statusResult.data);
    }
  };

  const refreshAll = async ({ silent = false, suppressErrors = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const list = await fetchApplications();
      const activeId = selectedId || String(list[0]?.id || "");
      if (activeId) {
        try {
          await fetchStatus(activeId);
        } catch (statusError) {
          // Silent fail on status fetch to avoid overriding success messages
          if (!silent && !suppressErrors) {
            console.warn("Status fetch failed:", statusError);
          }
        }
      }
    } catch (requestError) {
      if (!silent && !suppressErrors) {
        setError(
          requestError instanceof Error ? requestError.message : "Refresh failed",
        );
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetchStatus(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!autoRefresh) return undefined;

    const timer = setInterval(() => {
      refreshAll();
    }, 9000);

    return () => clearInterval(timer);
  }, [autoRefresh, selectedId]);

  const buildLoanRequestBody = () => ({
    ...loanForm,
    monthlyIncome: Number(loanForm.monthlyIncome || 0),
    loanAmount: Number(loanForm.loanAmount || 0),
    tenureMonths: Number(loanForm.tenureMonths || 0),
  });

  const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

  const buildDobString = (year, month, day) => {
    if (!year || !month || !day) return "";
    return `${year}-${month}-${day}`;
  };

  const handleDobPartChange = (part, value) => {
    const nextYear = part === "year" ? value : dobYear;
    const nextMonth = part === "month" ? value : dobMonth;
    const nextDay = part === "day" ? value : dobDay;
    let sanitizedDay = nextDay;

    if (nextYear && nextMonth && sanitizedDay) {
      const maxDay = getDaysInMonth(Number(nextYear), Number(nextMonth));
      if (Number(sanitizedDay) > maxDay) {
        sanitizedDay = String(maxDay).padStart(2, "0");
      }
    }

    if (part === "year") setDobYear(value);
    if (part === "month") setDobMonth(value);
    if (part === "day") setDobDay(value);

    const nextDate = buildDobString(nextYear, nextMonth, sanitizedDay);
    setLoanForm((prev) => ({
      ...prev,
      dateOfBirth: nextDate,
    }));
  };

  useEffect(() => {
    if (!loanForm.dateOfBirth) {
      return;
    }

    const [year, month, day] = loanForm.dateOfBirth.split("-");
    setDobYear(year || "");
    setDobMonth(month || "");
    setDobDay(day || "");
  }, [loanForm.dateOfBirth]);

  const saveDraftApplication = async () => {
    const targetId = editingApplicationId || draftApplicationId;
    const isEditing = Boolean(targetId);

    const result = await apiRequest({
      gateway,
      path: isEditing
        ? `/gateway/applications/${targetId}`
        : "/gateway/applications",
      method: isEditing ? "PUT" : "POST",
      token,
      body: buildLoanRequestBody(),
    });

    if (!result.ok) {
      throw new Error(
        result.error ||
          (isEditing
            ? "Could not update application draft."
            : "Could not create application draft."),
      );
    }

    const resolvedId = isEditing
      ? String(targetId)
      : result.data?.id
        ? String(result.data.id)
        : "";

    if (!resolvedId) {
      throw new Error("Application saved but id was missing in response.");
    }

    setEditingApplicationId(resolvedId);
    setDraftApplicationId(resolvedId);
    setSelectedId(resolvedId);
    return resolvedId;
  };

  const submitApplication = async (id) => {
    const result = await apiRequest({
      gateway,
      path: `/gateway/applications/${id}/submit`,
      method: "POST",
      token,
    });

    if (!result.ok) {
      throw new Error(result.error || "Submit action failed.");
    }
  };

  const startNewApplication = ({ clearMessages = true } = {}) => {
    setLoanForm(emptyLoanForm);
    setDobYear("");
    setDobMonth("");
    setDobDay("");
    setEditingApplicationId("");
    setDraftApplicationId("");
    setAllDocumentsUploaded(false);
    setWizardStep(1);
    if (clearMessages) {
      setError("");
      setNotice("");
    }
    setActiveTab("apply");
  };

  const openApplicationFromList = (app) => {
    setSelectedId(String(app.id));
    setActiveTab("all-applications");
    setShowDecisionDetails(false);
  };

  const handleWizardNext = async (event) => {
    event.preventDefault();
    setNotice("");
    setError("");

    if (wizardStep === 1) {
      setWizardStep(2);
      return;
    }

    if (wizardStep !== 2) {
      return;
    }

    setLoading(true);
    try {
      const id = await saveDraftApplication();
      setNotice(`Application #${id} saved. Continue to documents to submit.`);
      setWizardStep(3);
      await refreshAll();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Request failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async () => {
    setNotice("");
    setError("");

    if (!draftApplicationId) {
      setError("Please save your application draft before submission.");
      return;
    }

    if (!allDocumentsUploaded) {
      setError("Upload all 4 required documents before submitting.");
      return;
    }

    setLoading(true);
    try {
      await submitApplication(draftApplicationId);
      // Success - set notice first, then suppress all future errors
      setNotice("Application successfully submitted.");
      startNewApplication({ clearMessages: false });
      setSelectedId(String(draftApplicationId));
      setActiveTab("all-applications");

      // Refresh immediately after submit and suppress background errors.
      try {
        await refreshAll({ silent: true, suppressErrors: true });
      } catch (err) {
        // Completely ignore any errors from background refresh
        console.warn("Background refresh failed (ignored):", err);
      }
    } catch (requestError) {
      // Only show error if submission itself fails
      setError(
        requestError instanceof Error ? requestError.message : "Submission failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="dashboard">
      <section className="dashboard-head">
        <div>
          <p className="eyebrow">Applicant</p>
          <h2>User Dashboard</h2>
          <p className="muted">
            Welcome, {session.name || "Applicant"}. Complete your application
            step by step and submit after uploading all required documents.
          </p>
        </div>
      </section>

      {notice ? <p className="ok-text strip">{notice}</p> : null}
      {error ? <p className="error-text strip">{error}</p> : null}

      <section className="tab-nav">
        <button
          type="button"
          className={activeTab === "apply" ? "active" : ""}
          onClick={() => setActiveTab("apply")}
        >
          Apply Loan
        </button>
        <button
          type="button"
          className={activeTab === "all-applications" ? "active" : ""}
          onClick={() => setActiveTab("all-applications")}
        >
          All Loan Applications
        </button>
        <button
          type="button"
          className={activeTab === "status" ? "active" : ""}
          onClick={() => setActiveTab("status")}
        >
          Status & Timeline
        </button>
      </section>

      {activeTab === "apply" && (
        <section className="panel">
          <div className="wizard-top">
            <h3>
              {editingApplicationId
                ? `Application #${editingApplicationId}`
                : "New Loan Application"}
            </h3>
            <button
              type="button"
              className="secondary-btn"
              onClick={startNewApplication}
              disabled={loading}
            >
              Start New
            </button>
          </div>

          <div className="wizard-steps" aria-label="Application steps">
            <div className={`wizard-step ${wizardStep >= 1 ? "active" : ""}`}>
              1. Personal
            </div>
            <div className={`wizard-step ${wizardStep >= 2 ? "active" : ""}`}>
              2. Loan Details
            </div>
            <div className={`wizard-step ${wizardStep >= 3 ? "active" : ""}`}>
              3. Documents & Submit
            </div>
          </div>

          {wizardStep < 3 ? (
            <form className="card-form wizard-shell" onSubmit={handleWizardNext}>
              {wizardStep === 1 ? (
                <>
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
                    <div className="dob-selects" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                      <select
                        required
                        value={dobYear}
                        onChange={(event) => handleDobPartChange("year", event.target.value)}
                      >
                        <option value="">Year</option>
                        {Array.from({
                          length: new Date().getFullYear() - 1899,
                        })
                          .map((_, index) => {
                            const year = String(new Date().getFullYear() - index);
                            return (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            );
                          })}
                      </select>
                      <select
                        required
                        value={dobMonth}
                        onChange={(event) => handleDobPartChange("month", event.target.value)}
                      >
                        <option value="">Month</option>
                        {[
                          ["01", "Jan"],
                          ["02", "Feb"],
                          ["03", "Mar"],
                          ["04", "Apr"],
                          ["05", "May"],
                          ["06", "Jun"],
                          ["07", "Jul"],
                          ["08", "Aug"],
                          ["09", "Sep"],
                          ["10", "Oct"],
                          ["11", "Nov"],
                          ["12", "Dec"],
                        ].map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <select
                        required
                        value={dobDay}
                        onChange={(event) => handleDobPartChange("day", event.target.value)}
                      >
                        <option value="">Day</option>
                        {Array.from({
                          length: dobYear && dobMonth
                            ? getDaysInMonth(Number(dobYear), Number(dobMonth))
                            : 31,
                        }).map((_, index) => {
                          const day = String(index + 1).padStart(2, "0");
                          return (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </label>
                </>
              ) : (
                <>
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
                </>
              )}

              <div className="full wizard-actions">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setWizardStep((prev) => prev - 1)}
                    disabled={loading}
                  >
                    Back
                  </button>
                ) : null}
                <button type="submit" className="primary-btn" disabled={loading}>
                  Continue
                </button>
              </div>
            </form>
          ) : (
            <div className="wizard-shell">
              <DocumentChecklist
                applicationId={parseInt(draftApplicationId || "0", 10)}
                gateway={gateway}
                token={token}
                onChecklistUpdate={setAllDocumentsUploaded}
                loading={loading}
                showRefresh={false}
                showVerificationStatus={false}
              />

              <div className="wizard-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setWizardStep(2)}
                  disabled={loading}
                >
                  Back to Loan Details
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleFinalSubmit}
                  disabled={loading || !allDocumentsUploaded}
                  title={
                    allDocumentsUploaded
                      ? ""
                      : "Upload all required documents before submitting"
                  }
                >
                  Submit Application
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "all-applications" && (
        <section className="panel">
          <h3>All Loan Applications</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Applicant Name</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.length ? (
                  applications.map((app, index) => {
                    const tone = statusTone(app.status);

                    return (
                      <tr
                        key={app.id}
                        className={
                          String(app.id) === String(selectedId)
                            ? "active-row"
                            : ""
                        }
                      >
                        <td>{index + 1}</td>
                        <td>
                          <span className="applicant-name">{app.applicantName || "Anonymous"}</span>
                        </td>
                        <td>
                          <span className={`status ${tone}`}>{app.status}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => openApplicationFromList(app)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="3" className="muted-row">
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
                  <p className="eyebrow">Loan Application</p>
                  <h3>{selectedApplication.applicantName || selectedApplication.loanPurpose || "Loan Application"}</h3>
                </div>
                <div className="detail-action-group">
                  <span
                    className={`status ${statusTone(selectedApplication.status)}`}
                  >
                    {selectedApplication.status}
                  </span>
                  <button
                    type="button"
                    className="secondary-btn mini"
                    onClick={() => setShowDecisionDetails((prev) => !prev)}
                  >
                    {showDecisionDetails
                      ? "Hide Decision & Documents"
                      : "Show Decision & Documents"}
                  </button>
                </div>
              </div>

              <div className="detail-summary-grid">
                <article className="summary-card">
                  <span>Loan Amount</span>
                  <strong>{selectedApplication.loanAmount || "-"}</strong>
                </article>
                <article className="summary-card">
                  <span>Tenure</span>
                  <strong>{selectedApplication.tenureMonths || "-"} months</strong>
                </article>
                <article className="summary-card">
                  <span>Monthly Income</span>
                  <strong>{selectedApplication.monthlyIncome || "-"}</strong>
                </article>
              </div>

              <div className="detail-grid-two">
                <div className="detail-note">
                  <p className="detail-label">Applicant Name</p>
                  <p>{selectedApplication.applicantName || "-"}</p>
                  <p className="detail-label">Phone</p>
                  <p>{selectedApplication.phone || "-"}</p>
                  <p className="detail-label">Employer</p>
                  <p>{selectedApplication.employerName || "-"}</p>
                </div>
                <div className="detail-note">
                  <p className="detail-label">Applicant Email</p>
                  <p>{selectedApplication.applicantEmail || "-"}</p>
                  <p className="detail-label">Address</p>
                  <p>{selectedApplication.address || "-"}</p>
                  <p className="detail-label">Employment Type</p>
                  <p>{selectedApplication.employmentType || "-"}</p>
                </div>
              </div>

              {showDecisionDetails && (
                <div className="detail-extra-panel">
                  <div className="decision-card">
                    <h4>Admin Decision</h4>
                    <p>
                      <strong>Remark:</strong> {selectedAdminRemark}
                    </p>
                    <p>
                      <strong>Sanction Terms:</strong>{" "}
                      {selectedSanctionTerms || "No sanction terms shared yet."}
                    </p>
                  </div>

                  <div className="document-status-card">
                    <h4>Document Review</h4>
                    <DocumentChecklist
                      applicationId={parseInt(String(selectedApplication.id), 10)}
                      gateway={gateway}
                      token={token}
                      loading={loading}
                      readOnly
                      showRefresh={false}
                    />
                  </div>
                </div>
              )}

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
      )}

      {activeTab === "status" && (
        <section className="panel">
          <div className="switch-row">
            <h4>Status Timeline</h4>
            <label className="switch">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              Auto Refresh
            </label>
          </div>

          {statusInfo?.currentRemark ? (
            <p className="muted">
              Latest Admin Remark: {statusInfo.currentRemark}
            </p>
          ) : null}

          <div className="timeline">
            {Array.isArray(statusInfo?.timeline) && statusInfo.timeline.length ? (
              statusInfo.timeline.map((item, index) => (
                <article key={`${item.status}-${index}`} className="timeline-item">
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

      {chatOpen && (
        <div className="chatbot-floating-wrapper">
          <ChatbotPanel
            selectedApplication={selectedApplication}
            applications={applications}
            session={session}
            statusInfo={statusInfo}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}

      <button
        type="button"
        className="chatbot-toggle-btn"
        onClick={() => setChatOpen((prev) => !prev)}
        aria-expanded={chatOpen}
        aria-label={chatOpen ? "Close chatbot" : "Open chatbot"}
      >
        💬
      </button>
    </main>
  );
}

export default UserDashboard;
