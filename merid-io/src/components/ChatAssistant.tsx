"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { MessageCircle, Send, X, Bot } from "lucide-react";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
}

const ROLE_PRIORITY: string[] = ["ADMIN", "HR", "MANAGER", "EMPLOYEE"];
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  HR: "RH",
  MANAGER: "Manager",
  EMPLOYEE: "Employ\u00e9",
};

function detectPrimaryRole(roles: string[]): { key: string; label: string } {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) {
      return { key: r, label: ROLE_LABELS[r] ?? r };
    }
  }
  return { key: "EMPLOYEE", label: ROLE_LABELS.EMPLOYEE };
}

export function ChatAssistant() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userRoles = (session?.user?.roles as string[]) ?? [];
  const primaryRole = detectPrimaryRole(userRoles);
  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  // Set welcome message when opening for the first time
  useEffect(() => {
    if (open && messages.length === 0 && firstName) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Bonjour ${firstName} ! Comment puis-je vous aider aujourd'hui ?`,
        },
      ]);
    }
  }, [open, messages.length, firstName]);

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

  function handleSend() {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content: text },
    ]);
    setInput("");

    // Placeholder: echo response (will be replaced by real AI in next step)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Cette fonctionnalit\u00e9 sera bient\u00f4t disponible. L'IA Meridio est en cours de configuration.",
        },
      ]);
    }, 500);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

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
        <div className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-[#161b22]"
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
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#1B3A5C] text-white rounded-br-md"
                      : "bg-gray-100 text-gray-800 rounded-bl-md dark:bg-[#21262d] dark:text-gray-200"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
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
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4] dark:border-gray-600 dark:bg-[#0d1117] dark:text-gray-100 dark:placeholder-gray-500"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: input.trim() ? "#00BCD4" : undefined }}
                title="Envoyer"
              >
                <Send className={`h-4.5 w-4.5 ${input.trim() ? "text-white" : "text-gray-400 dark:text-gray-500"}`} />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-gray-400 dark:text-gray-500">
              Meridio AI peut faire des erreurs. V&eacute;rifiez les informations importantes.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
