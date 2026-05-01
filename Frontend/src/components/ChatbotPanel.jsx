import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2:1b";

function buildDashboardContext({ session, applications, selectedApplication, statusInfo }) {
  const lines = [];

  if (session) {
    lines.push("User dashboard context:");
    lines.push(`- User name: ${session.name || "Unknown"}`);
    lines.push(`- User email: ${session.email || session.userId || "Unknown"}`);
    lines.push(`- User role: ${session.role || "Unknown"}`);
  }

  if (applications?.length) {
    lines.push(`- Total loan applications: ${applications.length}`);
    lines.push("- Applications are listed newest first, with serial numbers based on the current displayed order.");
    applications.forEach((app, index) => {
      const selectedMark = selectedApplication?.id === app.id ? " [selected]" : "";
      lines.push(
        `  • Serial ${index + 1}: Application ${app.id}${selectedMark}, status=${app.status || "Unknown"}, amount=${app.loanAmount || "Unknown"}, tenure=${app.tenureMonths || "Unknown"}, purpose=${app.loanPurpose || "Unknown"}`,
      );
    });
  }

  if (selectedApplication) {
    lines.push("Selected application details:");
    lines.push(`- Application ID: ${selectedApplication.id}`);
    lines.push(`- Applicant: ${selectedApplication.applicantName || "Unknown"}`);
    lines.push(`- Status: ${selectedApplication.status || "Unknown"}`);
    lines.push(`- Loan amount: ${selectedApplication.loanAmount || "Unknown"}`);
    lines.push(`- Tenure: ${selectedApplication.tenureMonths || "Unknown"} months`);
    lines.push(`- Employment type: ${selectedApplication.employmentType || "Unknown"}`);
    lines.push(`- Purpose: ${selectedApplication.loanPurpose || "Unknown"}`);
    if (selectedApplication.statusNote) {
      lines.push(`- Status note: ${selectedApplication.statusNote}`);
    }
  }

  if (statusInfo) {
    lines.push(`- Latest status remark: ${statusInfo.currentRemark || "None"}`);
    if (Array.isArray(statusInfo.timeline) && statusInfo.timeline.length) {
      lines.push(`- Status timeline entries: ${statusInfo.timeline.length}`);
      statusInfo.timeline.forEach((item, index) => {
        lines.push(
          `  • ${index + 1}. ${item.status || "Unknown"} - ${item.description || "No description"} (${item.date || "Unknown date"})`,
        );
      });
    }
  }

  return lines.join("\n");
}

function ChatbotPanel({ selectedApplication, applications, session, statusInfo, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const model = DEFAULT_MODEL;

  const initialGreeting =
    "Hi! How can I help you today? Select one of the options below or ask your own question.";

  const quickActions = [
    {
      key: "apply",
      label: "How do I apply for a loan?",
    },
    {
      key: "summary",
      label: "Give me a summary of all applications.",
    },
    {
      key: "documents",
      label: "What documents do I need to submit?",
    },
    {
      key: "reviewTime",
      label: "How long does review take?",
    },
  ];

  const applicationContext = useMemo(
    () =>
      buildDashboardContext({
        session,
        applications,
        selectedApplication,
        statusInfo,
      }),
    [applications, selectedApplication, session, statusInfo],
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const appendMessage = (message) => {
    setMessages((prev) => [...prev, message]);
  };

  useEffect(() => {
    if (!messages.length) {
      appendMessage({
        role: "assistant",
        content: initialGreeting,
        showQuickActions: true,
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getSummaryResponse = () => {
    if (!Array.isArray(applications) || !applications.length) {
      return "You do not have any loan applications yet. Submit a new loan application to get started.";
    }

    const totals = applications.reduce(
      (counts, application) => {
        const status = String(application.status || "Unknown").toLowerCase();
        if (status.includes("approv")) counts.approved += 1;
        else if (status.includes("reject")) counts.rejected += 1;
        else if (status.includes("docspend")) counts.other += 1;
        else if (
          status.includes("submi") ||
          status.includes("underreview") ||
          status.includes("review") ||
          status.includes("pending")
        ) counts.pending += 1;
        else counts.other += 1;
        return counts;
      },
      { approved: 0, rejected: 0, pending: 0, other: 0 },
    );

    return `You have ${applications.length} applications: ${totals.approved} approved, ${totals.rejected} rejected, ${totals.pending} submitted/pending, and ${totals.other} in other states.`;
  };

  const getApplyGuideResponse = () =>
    "To apply for a loan: 1) fill out the personal information and loan details, 2) save the draft, 3) upload all required documents, and 4) submit the application. Once submitted, the admin will review and update your status.";

  const getDocumentGuideResponse = () =>
    "You need to upload all required documents for your loan application. Usually this includes identity proof, address proof, income proof, and any employment or bank documents. After uploading, submit your application so it can be reviewed.";

  const getReviewTimeResponse = () =>
    "Review typically takes a few business days after submission. It depends on document verification and admin availability, but you should expect an update within 2-4 business days. If you need a faster answer, please check the application status again after submission.";

  const parseMarkdownToJsx = (text) => {
    if (typeof text !== "string" || !text.length) return text;

    const renderInline = (lineText, keyPrefix) => {
      const segments = [];
      const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(lineText)) !== null) {
        if (match.index > lastIndex) {
          segments.push(lineText.slice(lastIndex, match.index));
        }

        const token = match[0];
        if (token.startsWith("`") && token.endsWith("`")) {
          segments.push(
            <code key={`${keyPrefix}-code-${lastIndex}`}>
              {token.slice(1, -1)}
            </code>,
          );
        } else if (token.startsWith("**") && token.endsWith("**")) {
          segments.push(
            <strong key={`${keyPrefix}-bold-${lastIndex}`}>
              {token.slice(2, -2)}
            </strong>,
          );
        } else {
          segments.push(token);
        }

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < lineText.length) {
        segments.push(lineText.slice(lastIndex));
      }

      return segments;
    };

    const lines = text.split("\n");
    const elements = [];
    let currentList = null;

    const flushList = () => {
      if (!currentList) return;
      elements.push(
        currentList.ordered ? (
          <ol key={elements.length}>
            {currentList.items.map((item, itemIndex) => (
              <li key={`ol-${itemIndex}`}>{renderInline(item, `ol-${itemIndex}`)}</li>
            ))}
          </ol>
        ) : (
          <ul key={elements.length}>
            {currentList.items.map((item, itemIndex) => (
              <li key={`ul-${itemIndex}`}>{renderInline(item, `ul-${itemIndex}`)}</li>
            ))}
          </ul>
        ),
      );
      currentList = null;
    };

    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      const unorderedMatch = trimmed.match(/^([*+-])\s+(.*)$/);
      const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);

      if (unorderedMatch || orderedMatch) {
        const itemText = unorderedMatch ? unorderedMatch[2] : orderedMatch[2];
        const isOrdered = Boolean(orderedMatch);

        if (!currentList || currentList.ordered !== isOrdered) {
          flushList();
          currentList = { ordered: isOrdered, items: [] };
        }

        currentList.items.push(itemText);
      } else {
        flushList();
        elements.push(
          <p key={`para-${lineIndex}`}>{renderInline(line, `para-${lineIndex}`)}</p>,
        );
      }
    });

    flushList();
    return elements;
  };

  const handleQuickAction = (key) => {
    const action = quickActions.find((item) => item.key === key);
    if (!action) return;

    appendMessage({ role: "user", content: action.label });

    let responseText = "";
    if (key === "apply") responseText = getApplyGuideResponse();
    else if (key === "summary") responseText = getSummaryResponse();
    else if (key === "documents") responseText = getDocumentGuideResponse();
    else if (key === "reviewTime") responseText = getReviewTimeResponse();

    appendMessage({ role: "assistant", content: responseText });
    setError("");
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt) return;

    setError("");
    appendMessage({ role: "user", content: prompt });
    setInput("");
    setLoading(true);

    const requestMessages = [
      {
        role: "system",
        content:
          "You are a helpful loan assistant for CapFinLoan customers. Keep responses concise, clear, and well-structured. Use bullet points for lists. If the user asks about a specific application, extract and present the key details directly from the provided application context without unnecessary explanations. Avoid verbose or rambling responses. Be direct and professional.",
      },
    ];

    if (applicationContext) {
      requestMessages.push({ role: "system", content: applicationContext });
    }

    requestMessages.push({ role: "user", content: prompt });

    try {
      const response = await fetch(`${DEFAULT_OLLAMA_HOST}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: requestMessages,
          stream: false,
        }),
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `Unexpected response: ${response.status}`);
      }

      const payload = JSON.parse(text);
      const assistantMessage =
        payload?.choices?.[0]?.message?.content ||
        "I received an empty response from the local model.";

      appendMessage({ role: "assistant", content: assistantMessage });
    } catch (networkError) {
      const fallback =
        "I couldn't reach the local Ollama service. Make sure Ollama is running and the model is available.";
      appendMessage({ role: "assistant", content: fallback });
      setError(networkError?.message || "Chatbot request failed.");
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  return (
    <section className="panel chatbot-panel">
      <div className="chatbot-header">
        <div>
          <h3>Loan Chatbot</h3>
          <p className="muted">
            Ask questions about your loan application or the next steps. Use this chat if you need guidance.
          </p>
        </div>
        <div className="chatbot-actions">
          {onClose ? (
            <button
              type="button"
              className="chatbot-close-btn"
              onClick={onClose}
              aria-label="Close chatbot"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div className="chatbot-body">
        <div className="chatbot-messages" aria-live="polite">
        {messages.length ? (
          messages.map((entry, index) => (
            <div
              key={`${entry.role}-${index}`}
              className={`chatbot-message ${entry.role}`}
            >
              <span className="role-label">
                {entry.role === "user" ? "You" : "Assistant"}
              </span>
              <p>{parseMarkdownToJsx(entry.content)}</p>
              {entry.showQuickActions ? (
                <div className="chatbot-quick-actions chatbot-quick-actions--inline">
                  {quickActions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      className="chatbot-action-btn"
                      onClick={() => handleQuickAction(action.key)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="muted">
            Type a question and press send. If you have a selected loan application,
            the chatbot will consider its details.
          </p>
        )}
        <div ref={messagesEndRef} />
      </div>
      </div>

      <form className="chatbot-form" onSubmit={handleSend}>
        <input
          className="chatbot-input"
          type="text"
          placeholder="Ask about your loan application..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="primary-btn"
          disabled={loading || !input.trim()}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </form>

      {error ? <p className="error-text strip">{error}</p> : null}
    </section>
  );
}

export default ChatbotPanel;
