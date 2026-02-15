"use client";

import { useRef, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send, X, Bot, ExternalLink, Loader2 } from "lucide-react";
import type { UIMessage } from "ai";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface OpenPageAction {
  url: string;
  label: string;
}

// ─── Role detection ─────────────────────────────────────────────────────────────

const ROLE_PRIORITY: string[] = ["ADMIN", "HR", "MANAGER", "EMPLOYEE"];
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  HR: "RH",
  MANAGER: "Manager",
  EMPLOYEE: "Employé",
};

function detectPrimaryRole(roles: string[]): { key: string; label: string } {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) {
      return { key: r, label: ROLE_LABELS[r] ?? r };
    }
  }
  return { key: "EMPLOYEE", label: ROLE_LABELS.EMPLOYEE };
}

// ─── Quick-action suggestions per role ──────────────────────────────────────────

const QUICK_ACTIONS: Record<string, OpenPageAction[]> = {
  EMPLOYEE: [
    { url: "/leaves/new", label: "Nouvelle demande" },
    { url: "/leaves/balances", label: "Voir mes soldes" },
    { url: "/leaves", label: "Mes congés" },
  ],
  MANAGER: [
    { url: "/manager/approvals", label: "Approbations en attente" },
    { url: "/manager/calendar", label: "Calendrier équipe" },
    { url: "/manager/delegations", label: "Délégations" },
  ],
  HR: [
    { url: "/hr/approvals", label: "Approbations RH" },
    { url: "/hr/dashboard", label: "Tableau de bord RH" },
    { url: "/hr/balances", label: "Soldes employés" },
  ],
  ADMIN: [
    { url: "/admin/company", label: "Config entreprise" },
    { url: "/admin/users", label: "Gestion utilisateurs" },
    { url: "/admin/workflows", label: "Workflows" },
  ],
};

// ─── Extract open_page tool invocations from message parts ──────────────────────

function extractActions(msg: UIMessage): OpenPageAction[] {
  const actions: OpenPageAction[] = [];
  for (const part of msg.parts) {
    // Tool parts have type "tool-<toolName>"
    if (part.type.startsWith("tool-") && "output" in part && part.output) {
      const output = part.output as { url?: string; label?: string };
      if (output.url && output.label) {
        actions.push({ url: output.url, label: output.label });
      }
    }
  }
  return actions;
}

// ─── Extract text content from message parts ────────────────────────────────────

function getTextContent(msg: UIMessage): string {
  return msg.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");
}

// ─── Action button component ────────────────────────────────────────────────────

function ActionButton({ action, onClick }: { action: OpenPageAction; onClick: (url: string) => void }) {
  return (
    <button
      onClick={() => onClick(action.url)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#00BCD4]/30 bg-[#00BCD4]/10 px-3 py-1.5 text-xs font-medium text-[#00BCD4] transition-colors hover:bg-[#00BCD4]/20 hover:border-[#00BCD4]/50 dark:border-[#00BCD4]/25 dark:bg-[#00BCD4]/5 dark:hover:bg-[#00BCD4]/15"
    >
      <ExternalLink className="h-3 w-3" />
      {action.label}
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function ChatAssistant() {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userRoles = (session?.user?.roles as string[]) ?? [];
  const primaryRole = detectPrimaryRole(userRoles);
  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  const { messages, sendMessage, status, setMessages } = useChat();

  const isLoading = status === "streaming" || status === "submitted";

  // Set welcome message when opening for the first time
  useEffect(() => {
    if (open && messages.length === 0 && firstName) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          parts: [{ type: "text", text: `Bonjour ${firstName} ! Comment puis-je vous aider aujourd'hui ?` }],
        },
      ]);
    }
  }, [open, messages.length, firstName, setMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  function navigateTo(url: string) {
    router.push(url);
    setOpen(false);
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({ text });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Show quick actions only after welcome, before any user message
  const showQuickActions = messages.length === 1 && messages[0]?.role === "assistant";
  const quickActions = QUICK_ACTIONS[primaryRole.key] ?? QUICK_ACTIONS.EMPLOYEE;

  if (!session?.user) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ backgroundColor: "#1B3A5C" }}
          title="Meridio AI"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-[#161b22]"
          style={{ width: 400, height: 600, maxHeight: "calc(100vh - 48px)", maxWidth: "calc(100vw - 48px)" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between rounded-t-2xl px-5 py-4"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Meridio AI</h3>
                <span className="text-xs text-white/70">({primaryRole.label})</span>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg) => {
              const textContent = getTextContent(msg);
              const actions = extractActions(msg);
              if (!textContent && actions.length === 0) return null;

              return (
                <div key={msg.id}>
                  {/* Message bubble */}
                  {textContent && (
                    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-[#1B3A5C] text-white rounded-br-md"
                            : "bg-gray-100 text-gray-800 rounded-bl-md dark:bg-[#21262d] dark:text-gray-200"
                        }`}
                      >
                        {textContent}
                      </div>
                    </div>
                  )}

                  {/* Tool call action buttons */}
                  {actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 pl-1">
                      {actions.map((action, i) => (
                        <ActionButton key={`${msg.id}-action-${i}`} action={action} onClick={navigateTo} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-sm text-gray-500 dark:bg-[#21262d] dark:text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Meridio AI réfléchit…
                </div>
              </div>
            )}

            {/* Quick action buttons (shown after welcome message only) */}
            {showQuickActions && !isLoading && (
              <div className="flex flex-wrap gap-2 pl-1">
                {quickActions.map((action) => (
                  <ActionButton key={action.url} action={action} onClick={navigateTo} />
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                disabled={isLoading}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4] disabled:opacity-50 dark:border-gray-600 dark:bg-[#0d1117] dark:text-gray-100 dark:placeholder-gray-500"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: input.trim() && !isLoading ? "#00BCD4" : undefined }}
                title="Envoyer"
              >
                <Send className={`h-4.5 w-4.5 ${input.trim() && !isLoading ? "text-white" : "text-gray-400 dark:text-gray-500"}`} />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-gray-400 dark:text-gray-500">
              Meridio AI peut faire des erreurs. Vérifiez les informations importantes.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
