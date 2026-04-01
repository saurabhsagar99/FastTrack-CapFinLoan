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

export {
  DEFAULT_DOCUMENT_SERVICE,
  DEFAULT_GATEWAY,
  SESSION_KEY,
  apiRequest,
  downloadCsv,
  emptyLoanForm,
  emptySession,
  formatDateTime,
  mapDecisionStatusToApplicationStatus,
  normalizeKeys,
  normalizeRole,
  parseJsonSafe,
  parseStatusNoteParts,
  parseStoredSession,
  statusTone,
};
