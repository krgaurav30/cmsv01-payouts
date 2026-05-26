"use client";

import React, { useState, useRef, useEffect } from "react";

type Message = {
  id: string;
  role: "user" | "model";
  text: string;
  transaction?: any;
  loading?: boolean;
};

import type { CorporateSession } from "../../../lib/types";

type ChatbotProps = {
  session: CorporateSession;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        background: "transparent",
        border: "none",
        color: copied ? "#22c55e" : "#64748b",
        cursor: "pointer",
        padding: "2px 4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "4px",
        transition: "color 0.2s, background-color 0.2s",
        marginTop: "4px",
        fontSize: "10.5px",
        gap: "4px",
        alignSelf: "flex-end",
      }}
      onMouseEnter={(e) => {
        if (!copied) e.currentTarget.style.color = "#94a3b8";
      }}
      onMouseLeave={(e) => {
        if (!copied) e.currentTarget.style.color = "#64748b";
      }}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

type ChatInputProps = {
  onSend: (text: string) => void;
  disabled: boolean;
};

function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSend(value);
      setValue("");
    }
  };

  return (
    <div
      style={{
        padding: "16px",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(15, 23, 42, 0.8)",
        display: "flex",
        gap: "8px",
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="Type your instruction..."
        disabled={disabled}
        style={{
          flex: 1,
          background: "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "8px",
          padding: "10px 12px",
          color: "#fff",
          fontSize: "13px",
          outline: "none",
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={disabled}
        style={{
          padding: "10px 14px",
          borderRadius: "8px",
          background: "#4f46e5",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  );
}

const welcomeMessageId = "welcome";

export function Chatbot({ session }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const initialMessages: Message[] = [
    {
      id: welcomeMessageId,
      role: "model",
      text: `Hello ${session.username}! I am your CMS Payout Assistant. How can I help you manage your transactions today?\n\n*You can ask me to list recent batches, create a new payout, or approve pending payouts (if you are a checker).*`,
    },
  ];
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages(initialMessages);
    setHistory([]);
    setLoading(false);
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const botMessageId = `bot-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", text: textToSend },
      { id: botMessageId, role: "model", text: "", loading: true },
    ]);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/bff/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: textToSend,
          history,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message || "Chat request failed");
      }

      const data = await response.json();

      // Look inside data.history (the new turns) to see if we invoked creation/approval tools.
      // If we did, let's extract the transaction details to display inside a premium UI card!
      let parsedTxn: any = null;
      if (data.history && Array.isArray(data.history)) {
        for (const turn of data.history) {
          if (turn.role === "user" && turn.parts) {
            for (const part of turn.parts) {
              if (part.functionResponse && part.functionResponse.response?.result) {
                const res = part.functionResponse.response.result;
                // If it looks like a batch/transaction object, let's keep it
                if (res.batchId || res.data?.batchId) {
                  parsedTxn = res.batchId ? res : res.data;
                }
              }
            }
          }
        }
      }

      // Update the bot message with final text and parsed transaction card
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? {
                ...msg,
                text: data.text || "I have processed your request.",
                loading: false,
                transaction: parsedTxn,
              }
            : msg
        )
      );

      // Append new history turns
      setHistory((prev) => [...prev, ...(data.history || [])]);
    } catch (error: any) {
      if (error.name === "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? {
                  ...msg,
                  text: "Request stopped by user.",
                  loading: false,
                }
              : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? {
                  ...msg,
                  text: `Sorry, I encountered an issue: ${error.message || "An unknown error occurred."}`,
                  loading: false,
                }
              : msg
          )
        );
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    handleSend(prompt);
  };

  const formatText = (text: string) => {
    return text.split("\n").map((line, idx) => {
      let formatted = line;
      // Bold syntax **text** or *text*
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
      return (
        <p
          key={idx}
          dangerouslySetInnerHTML={{ __html: formatted }}
          style={{ margin: "4px 0" }}
        />
      );
    });
  };

  return (
    <>
      {/* Floating launcher button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4), 0 8px 10px -6px rgba(79, 70, 229, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          transition: "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          transform: isOpen ? "rotate(45deg) scale(0.9)" : "scale(1)",
        }}
        title="CMS Copilot"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
      </button>

      {/* Slide-out Chat Panel */}
      <div
        style={{
          position: "fixed",
          bottom: "96px",
          right: "24px",
          width: "380px",
          height: "600px",
          maxHeight: "calc(100vh - 120px)",
          borderRadius: "16px",
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          zIndex: 9998,
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "translateY(0)" : "translateY(20px)",
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden",
          color: "#f8fafc",
          fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px",
            background: "linear-gradient(90deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.6) 100%)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "#22c55e",
                boxShadow: "0 0 8px #22c55e",
              }}
            />
            <div>
              <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>CMS Assistant</h3>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                Logged in as {session.username} ({session.role})
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Reset conversation button */}
            <button
              onClick={handleReset}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                transition: "color 0.2s, background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ef4444";
                e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#94a3b8";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              title="Reset conversation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
            </button>

            {/* Close button (cross CTA) */}
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                transition: "color 0.2s, background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#94a3b8";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              title="Close chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Messages list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    fontSize: "13.5px",
                    lineHeight: "1.5",
                    background: msg.role === "user" ? "#4f46e5" : "rgba(255, 255, 255, 0.06)",
                    border: msg.role === "user" ? "none" : "1px solid rgba(255, 255, 255, 0.08)",
                    color: "#f8fafc",
                    width: "100%",
                  }}
                >
                  {msg.loading ? (
                    <div style={{ display: "flex", gap: "4px", padding: "4px 8px" }}>
                      <div className="chatbot-dot" />
                      <div className="chatbot-dot" />
                      <div className="chatbot-dot" />
                    </div>
                  ) : (
                    formatText(msg.text)
                  )}
                </div>
                {!msg.loading && msg.text && <CopyButton text={msg.text} />}
              </div>

              {/* Transaction Context Card (custom rendering) */}
              {msg.transaction && (
                <div
                  style={{
                    marginTop: "8px",
                    width: "85%",
                    background: "rgba(30, 41, 59, 0.5)",
                    border: "1px solid rgba(99, 102, 241, 0.25)",
                    borderRadius: "12px",
                    padding: "12px",
                    fontSize: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "#818cf8" }}>Transaction Details</span>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: 600,
                        backgroundColor:
                          msg.transaction.state === "approved" || msg.transaction.state === "paid"
                            ? "rgba(34, 197, 94, 0.2)"
                            : "rgba(234, 179, 8, 0.2)",
                        color:
                          msg.transaction.state === "approved" || msg.transaction.state === "paid"
                            ? "#4ade80"
                            : "#facc15",
                      }}
                    >
                      {msg.transaction.state?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <strong>ID:</strong> <code style={{ fontSize: "11px", color: "#cbd5e1" }}>{msg.transaction.batchId}</code>
                  </div>
                  <div>
                    <strong>Title:</strong> {msg.transaction.title}
                  </div>
                  <div>
                    <strong>Amount:</strong> ₹{Number((msg.transaction.totalAmount?.value || msg.transaction.totalAmount || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  {msg.transaction.utr && (
                    <div>
                      <strong>UTR:</strong> <code style={{ color: "#4ade80" }}>{msg.transaction.utr}</code>
                    </div>
                  )}

                  {/* Actions inside chat */}
                  {msg.transaction.state === "pending_approval" && session.role === "checker" && (
                    <button
                      onClick={() => handleSend(`Approve transaction ${msg.transaction.batchId}`)}
                      style={{
                        marginTop: "8px",
                        width: "100%",
                        padding: "6px",
                        borderRadius: "6px",
                        background: "#6366f1",
                        color: "#fff",
                        border: "none",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Approve Payout
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {messages.length === 1 && !loading && (
          <div
            style={{
              padding: "0 16px 12px 16px",
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <button
              onClick={() => handleSuggestionClick("Show recent transactions")}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                color: "#cbd5e1",
                padding: "6px 10px",
                borderRadius: "15px",
                fontSize: "12px",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
            >
              List transactions
            </button>
            <button
              onClick={() =>
                handleSuggestionClick("Create a payout of 500 INR for beneficiary 8826654341 using package ZELPAY")
              }
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                color: "#cbd5e1",
                padding: "6px 10px",
                borderRadius: "15px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Create ₹500 Payout
            </button>
          </div>
        )}

        {/* Input area */}
        <div style={{ position: "relative" }}>
          {loading && (
            <div
              style={{
                position: "absolute",
                top: "-42px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10,
              }}
            >
              <button
                onClick={handleStop}
                style={{
                  padding: "6px 12px",
                  borderRadius: "15px",
                  background: "rgba(239, 68, 68, 0.9)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
                  backdropFilter: "blur(4px)",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#dc2626";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.9)";
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                </svg>
                Stop Generating
              </button>
            </div>
          )}
          <ChatInput onSend={handleSend} disabled={loading} />
        </div>
      </div>


    </>
  );
}
