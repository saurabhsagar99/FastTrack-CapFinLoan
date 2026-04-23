import { useEffect, useState } from "react";

function DocumentChecklist({
  applicationId,
  gateway,
  token,
  onChecklistUpdate,
  loading,
  readOnly = false,
}) {
  const [checklist, setChecklist] = useState(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState("");
  const [selectedDocType, setSelectedDocType] = useState("KYC");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingDocType, setUploadingDocType] = useState(null);

  const fetchChecklist = async () => {
    if (!applicationId) return;
    
    setChecklistLoading(true);
    setChecklistError("");
    
    try {
      const response = await fetch(
        `${gateway}/gateway/documents/${applicationId}/required`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch required documents checklist");
      }

      const result = await response.json();
      setChecklist(result.data);
      
      if (onChecklistUpdate) {
        onChecklistUpdate(result.data?.allRequiredDocumentsUploaded);
      }
    } catch (error) {
      setChecklistError(
        error instanceof Error ? error.message : "Failed to load checklist"
      );
      setChecklist(null);
    } finally {
      setChecklistLoading(false);
    }
  };

  // Auto-fetch checklist when applicationId changes
  useEffect(() => {
    if (applicationId) {
      fetchChecklist();
    }
  }, [applicationId]);

  const uploadDocument = async (docType, file) => {
    if (!applicationId || !file) return;

    setUploadingDocType(docType);
    setChecklistError("");

    try {
      const formData = new FormData();
      formData.append("applicationId", String(applicationId));
      formData.append("documentType", docType);
      formData.append("file", file);

      const response = await fetch(`${gateway}/gateway/documents/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload document");
      }

      setSelectedFile(null);
      setSelectedDocType("KYC");
      await fetchChecklist();
    } catch (error) {
      setChecklistError(
        error instanceof Error ? error.message : "Upload failed"
      );
    } finally {
      setUploadingDocType(null);
    }
  };

  const isAllUploaded = checklist?.allRequiredDocumentsUploaded ?? false;

  return (
    <section className="document-checklist-section">
      <h3>{readOnly ? "Document Upload Status" : "Required Documents"}</h3>
      <p className="muted">
        {readOnly
          ? "View uploaded/pending documents and admin verification remarks."
          : "Upload all 4 required documents to submit your application."}
      </p>

      {checklistLoading && <p className="muted">Loading document checklist...</p>}

      {checklistError && <p className="error-text">{checklistError}</p>}

      {checklist ? (
        <>
          <div className="documents-checklist">
            {checklist.requiredDocuments?.map((doc) => (
              <div key={doc.documentType} className="checklist-item">
                <div className="checklist-header">
                  <div className="checklist-status">
                    <span
                      className={`status-indicator ${
                        doc.isUploaded ? "uploaded" : "pending"
                      }`}
                    >
                      {doc.isUploaded ? "✓" : "○"}
                    </span>
                    <div>
                      <p className="document-name">{doc.displayName}</p>
                      {doc.isUploaded && (
                        <p className="document-meta">
                          {doc.isVerified ? (
                            <span className="verified">✓ Verified by Admin</span>
                          ) : (
                            <span className="pending-verification">
                              ⏳ Pending Verification
                            </span>
                          )}
                        </p>
                      )}
                      {doc.verificationRemarks && (
                        <p className="remark-text">
                          Admin: {doc.verificationRemarks}
                        </p>
                      )}
                    </div>
                  </div>

                  {!doc.isUploaded && !readOnly && (
                    <div className="upload-input-group">
                      <input
                        type="file"
                        id={`file-${doc.documentType}`}
                        onChange={(e) => {
                          setSelectedDocType(doc.documentType);
                          setSelectedFile(e.target.files?.[0] || null);
                        }}
                        accept=".pdf,.jpg,.jpeg,.png"
                        disabled={uploadingDocType !== null || loading}
                      />
                      <label htmlFor={`file-${doc.documentType}`}>
                        Choose File
                      </label>
                      {selectedDocType === doc.documentType && selectedFile && (
                        <button
                          type="button"
                          className="small-btn"
                          onClick={() =>
                            uploadDocument(doc.documentType, selectedFile)
                          }
                          disabled={uploadingDocType !== null || loading}
                        >
                          {uploadingDocType === doc.documentType
                            ? "Uploading..."
                            : "Upload"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="checklist-summary">
            {isAllUploaded ? (
              <div className="all-uploaded">
                <p className="ok-text">
                  {readOnly
                    ? "✓ All required documents uploaded."
                    : "✓ All required documents uploaded. You can now submit your application."}
                </p>
              </div>
            ) : (
              <div className="pending-uploads">
                <p className="warning-text">
                  {checklist.requiredDocuments?.filter(d => !d.isUploaded).length} of {checklist.requiredDocuments?.length} documents still needed.
                </p>
              </div>
            )}
          </div>
        </>
      ) : !checklistLoading ? (
        <p className="muted">
          {applicationId
            ? "Click 'Refresh Checklist' to load document status."
            : "Please create or select an application first."}
        </p>
      ) : null}

      {!checklistLoading && checklist && (
        <button
          type="button"
          className="secondary-btn"
          onClick={fetchChecklist}
          style={{ marginTop: "1rem" }}
          disabled={loading}
        >
          Refresh Checklist
        </button>
      )}
    </section>
  );
}

export default DocumentChecklist;
