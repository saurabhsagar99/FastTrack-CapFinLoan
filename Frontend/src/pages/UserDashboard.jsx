import { useEffect, useState } from "react";
import {
  apiRequest,
  emptyLoanForm,
  formatDateTime,
  parseStatusNoteParts,
  statusTone,
} from "../utils/appUtils";

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
                {editingApplicationId
                  ? "Edit Loan Application"
                  : "Apply For Loan"}
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
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={loading}
                >
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
                            <span className={`status ${tone}`}>
                              {app.status}
                            </span>
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
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => startEditApplication(app)}
                                disabled={
                                  loading ||
                                  String(app.status || "").toUpperCase() !==
                                    "DRAFT"
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
            {Array.isArray(statusInfo?.timeline) &&
            statusInfo.timeline.length ? (
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

export default UserDashboard;
