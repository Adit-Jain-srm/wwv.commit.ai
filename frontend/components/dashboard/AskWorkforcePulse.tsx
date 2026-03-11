"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MessageCircle, Send } from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const SUGGESTED_QUESTIONS = [
  "What industries are growing fastest in Montgomery?",
  "What training programs should we fund?",
  "What skills will be in demand next year?",
  "How does public sector hiring compare to private?",
];

/** Convert minimal markdown (bold, bullet lists) to HTML for display. */
function formatAIContent(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^[-•]\s+/gm, "&#8226; ");
}

type Message = { role: "user" | "assistant"; content: string };

export function AskWorkforcePulse() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text) return;

    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    setError(null);

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
          : "Sorry, I couldn’t get an answer. Try again or run the data pipeline.";

      if (!res.ok) {
        setError(answer || `Request failed (${res.status})`);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: answer || "Something went wrong." },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      }
    } catch (e) {
      const errMsg =
        e instanceof Error ? e.message : "Backend unreachable. Start the API.";
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Unable to reach Workforce Pulse: ${errMsg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-sky-900/60 bg-slate-950/80 shadow-lg shadow-slate-900/20 transition-shadow hover:shadow-slate-900/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <MessageCircle className="h-4 w-4 text-sky-400" />
          Ask Workforce Pulse
        </CardTitle>
        <p className="text-[11px] text-slate-500">
          AI assistant for city planning. Ask about industries, training, or skills.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="e.g. What industries are growing fastest?"
            className="flex-1 rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
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

        {SUGGESTED_QUESTIONS.length > 0 && messages.length === 0 && (
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
                    className="w-full rounded border border-slate-800 bg-slate-900/50 px-2 py-1.5 text-left text-[11px] text-slate-300 hover:border-sky-800 hover:bg-slate-800/50 hover:text-sky-200"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="max-h-[280px] space-y-3 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "rounded-md bg-sky-900/30 px-2.5 py-2 text-[11px] text-slate-200"
                  : "rounded-md border border-slate-800 bg-slate-900/50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap [&_strong]:font-semibold [&_strong]:text-slate-100"
              }
              {...(m.role === "assistant"
                ? { dangerouslySetInnerHTML: { __html: formatAIContent(m.content) } }
                : { children: m.content })}
            />
          ))}
          {loading && (
            <div className="rounded-md border border-slate-800 bg-slate-900/50 px-2.5 py-2 text-[11px] text-slate-500">
              Thinking…
            </div>
          )}
        </div>

        {error && (
          <p className="text-[10px] text-amber-400">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
