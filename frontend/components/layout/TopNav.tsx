"use client";

import { useRef, useState } from "react";
import { MessageCircle, Send, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { UserMenu } from "../UserMenu";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const AI_NAME = "Pulse AI";

const SUGGESTED_QUESTIONS = [
  "What industries are growing fastest in Montgomery?",
  "What training programs should we fund?",
  "What skills will be in demand next year?",
  "How does public sector hiring compare to private?",
];

type Message = { role: "user" | "assistant"; content: string };

interface TopNavProps {
  onExportPdf?: () => void;
  exportLoading?: boolean;
}

export function TopNav({
  onExportPdf,
  exportLoading = false,
}: TopNavProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const send = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text || loading) return;

    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });

      const data = await res.json().catch(() => ({}));
      const answer =
        typeof data.answer === "string"
          ? data.answer
          : "Sorry, I couldn't get an answer. Try again or run the data pipeline.";

      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch (e) {
      const errMsg =
        e instanceof Error ? e.message : "Backend unreachable. Start the API.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Unable to reach ${AI_NAME}: ${errMsg}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="print:hidden border-b border-slate-900/80 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-2 lg:px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 via-emerald-400 to-sky-700 shadow-lg shadow-sky-900/50" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Workforce Pulse
              </span>
              <Badge variant="success">Live beta</Badge>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-slate-300">
              <span className="font-semibold text-slate-100">
                Montgomery, Alabama
              </span>
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              <span className="text-slate-400">Workforce & economic signal board</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* ---- Pulse AI trigger ---- */}
          <div className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => {
                setOpen((o) => !o);
                if (!open) setTimeout(() => inputRef.current?.focus(), 60);
              }}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] transition-colors",
                open
                  ? "border-sky-500/60 bg-sky-950/40 text-sky-300"
                  : "border-slate-800/80 bg-slate-900/70 text-slate-400 hover:border-sky-700/50 hover:text-sky-300"
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="font-medium">{AI_NAME}</span>
              <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
            </button>

            {/* ---- Dropdown panel ---- */}
            {open && (
              <>
                {/* backdrop to close */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setOpen(false)}
                />
                <div
                  ref={panelRef}
                  className="absolute right-0 top-full z-50 mt-2 w-[420px] rounded-lg border border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/40"
                >
                  <div className="border-b border-slate-800 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-sky-400" />
                      <span className="text-sm font-semibold text-slate-200">{AI_NAME}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      AI assistant for city planning. Ask about industries, training, or skills.
                    </p>
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {/* Input row */}
                    <div className="flex gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && send()}
                        placeholder="e.g. What industries are growing fastest?"
                        className="flex-1 rounded-md border border-slate-700 bg-slate-950/80 px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                      />
                      <button
                        type="button"
                        onClick={() => send()}
                        disabled={loading}
                        className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Suggested questions (shown when no messages yet) */}
                    {messages.length === 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          Try asking
                        </p>
                        <ul className="space-y-1">
                          {SUGGESTED_QUESTIONS.map((q, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                onClick={() => send(q)}
                                className="w-full rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-left text-[11px] text-slate-300 hover:border-sky-800 hover:bg-slate-800/50 hover:text-sky-200 transition-colors"
                              >
                                {q}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Messages */}
                    {messages.length > 0 && (
                      <div className="max-h-[320px] space-y-2 overflow-y-auto">
                        {messages.map((m, i) => (
                          <div
                            key={i}
                            className={
                              m.role === "user"
                                ? "rounded-md bg-sky-900/30 px-2.5 py-2 text-[11px] text-slate-200"
                                : "rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap"
                            }
                          >
                            {m.content}
                          </div>
                        ))}
                        {loading && (
                          <div className="rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-2 text-[11px] text-slate-500 animate-pulse">
                            {AI_NAME} is thinking...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <Button
            variant="subtle"
            size="sm"
            className="hidden md:inline-flex gap-1.5 text-[12px]"
            onClick={onExportPdf ?? (() => typeof window !== "undefined" && window.print())}
            disabled={exportLoading}
          >
            {exportLoading ? (
              <span className="animate-pulse">Generating report...</span>
            ) : (
              <>
                <span className="uppercase tracking-[0.16em]">Export</span>
                <span className="text-slate-300/80">PDF</span>
              </>
            )}
          </Button>

          <UserMenu name="City Planner" />
        </div>
      </div>
    </header>
  );
}
