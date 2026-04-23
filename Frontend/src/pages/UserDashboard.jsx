import { useEffect, useState } from "react";
import {
  apiRequest,
  emptyLoanForm,
  formatDateTime,
  parseStatusNoteParts,
  statusTone,
} from "../utils/appUtils";
import DocumentChecklist from "../components/DocumentChecklist";

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
  const [activeTab, setActiveTab] = useState("applications");
  const [allDocumentsUploaded, setAllDocumentsUploaded] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

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

  const refreshAll = async () => {
    setLoading(true);
    setError("");

    try {
      const list = await fetchApplications();
      const activeId = selectedId || String(list[0]?.id || "");
      if (activeId) {
        await fetchStatus(activeId);
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

  const startEditApplication = (app, step = 1) => {
    const id = String(app.id);
    setEditingApplicationId(id);
    setDraftApplicationId(id);
    setSelectedId(id);
    setAllDocumentsUploaded(false);
    setWizardStep(step);
    setActiveTab("applications");

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

  const startNewApplication = () => {
    setLoanForm(emptyLoanForm);
    setEditingApplicationId("");
    setDraftApplicationId("");
    setAllDocumentsUploaded(false);
    setWizardStep(1);
    setError("");
    setNotice("");
    setActiveTab("applications");
  };

  const openApplicationFromList = (app) => {
    setSelectedId(String(app.id));

    if (String(app.status || "").toUpperCase() === "DRAFT") {
      startEditApplication(app, 1);
    }
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
      setNotice(`Application ${draftApplicationId} submitted for review.`);
      setSelectedId(String(draftApplicationId));
      startNewApplication();
      await refreshAll();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Request failed",
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
          className={activeTab === "applications" ? "active" : ""}
          onClick={() => setActiveTab("applications")}
        >
          Applications
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
              <div
                className={`wizard-step ${wizardStep >= 1 ? "active" : ""}`}
              >
                1. Personal
              </div>
              <div
                className={`wizard-step ${wizardStep >= 2 ? "active" : ""}`}
              >
                2. Loan Details
              </div>
              <div
                className={`wizard-step ${wizardStep >= 3 ? "active" : ""}`}
              >
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
                      const isDraft =
                        String(app.status || "").toUpperCase() === "DRAFT";

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
                              onClick={() => openApplicationFromList(app)}
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
                          <td>
                            {app.sanctionTerms ||
                              noteParts.sanctionTerms ||
                              "-"}
                          </td>
                          <td>{new Date(app.updatedAt).toLocaleString()}</td>
                          <td>
                            <div className="action-row">
                              {isDraft ? <span className="muted">Open from ID</span> : <span className="muted">Already submitted</span>}
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
                    <p className="eyebrow">
                      Application #{selectedApplication.id}
                    </p>
                    <h3>
                      {selectedApplication.loanPurpose || "Loan Application"}
                    </h3>
                  </div>
                  <span
                    className={`status ${statusTone(selectedApplication.status)}`}
                  >
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
                    <strong>
                      {selectedApplication.tenureMonths || "-"} months
                    </strong>
                  </article>
                  <article>
                    <span>Monthly Income</span>
                    <strong>{selectedApplication.monthlyIncome || "-"}</strong>
                  </article>
                </div>

                <div className="detail-grid-two">
                  <p>
                    <strong>Applicant Name</strong>
                    {selectedApplication.applicantName || "-"}
                  </p>
                  <p>
                    <strong>Applicant Email</strong>
                    {selectedApplication.applicantEmail || "-"}
                  </p>
                  <p>
                    <strong>Phone</strong>
                    {selectedApplication.phone || "-"}
                  </p>
                  <p>
                    <strong>Address</strong>
                    {selectedApplication.address || "-"}
                  </p>
                  <p>
                    <strong>Employer</strong>
                    {selectedApplication.employerName || "-"}
                  </p>
                  <p>
                    <strong>Employment Type</strong>
                    {selectedApplication.employmentType || "-"}
                  </p>
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

                <div className="detail-documents-card">
                  <DocumentChecklist
                    applicationId={parseInt(String(selectedApplication.id), 10)}
                    gateway={gateway}
                    token={token}
                    loading={loading}
                    readOnly
                  />
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
    </main>
  );
}

export default UserDashboard;
