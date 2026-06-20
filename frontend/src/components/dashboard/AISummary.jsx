import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import {
  TrendingUp,
  AlertTriangle,
  PiggyBank,
  Eye,
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  HelpCircle,
  Cpu,
} from "lucide-react";

// Sub-component to render text with typing effect
function TypewriterEffect({ text }) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!text) return;
    let index = 0;
    setDisplayedText("");
    
    const timer = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(index));
      index++;
      if (index >= text.length - 1) {
        clearInterval(timer);
      }
    }, 15); // Typing speed 15ms per character

    return () => clearInterval(timer);
  }, [text]);

  return <span className="inline font-sans text-sm text-slate-700 leading-relaxed">{displayedText}</span>;
}

export default function AISummary({ transactions = [] }) {
  const queryClient = useQueryClient();
  const [askQuery, setAskQuery] = useState("");
  const [chatResponse, setChatResponse] = useState(null);
  const [chatError, setChatError] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Fetch Session User ID
  const [userId, setUserId] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });
  }, []);

  // 1. Fetch AI Insights (POST request via React Query)
  const {
    data: report,
    isLoading: isReportLoading,
    error: reportError,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ["ai_insights_report", userId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/insights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ transactions: transactions.slice(0, 30) }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.message || errorJson.error || "Failed to retrieve report.");
      }

      const resJson = await response.json();
      return resJson.insight;
    },
    enabled: !!userId && transactions.length > 0,
    retry: false, // Don't retry on rate limit errors
  });

  // 2. Natural Language Query (NLQ) Mutation
  const chatMutation = useMutation({
    mutationFn: async (question) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          question,
          transactions: transactions.slice(0, 30),
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.message || errorJson.error || "Failed to query finance assistant.");
      }

      return response.json();
    },
    onMutate: () => {
      setIsChatLoading(true);
      setChatError("");
      setChatResponse(null);
    },
    onSuccess: (data) => {
      setChatResponse(data);
    },
    onError: (err) => {
      setChatError(err.message);
    },
    onSettled: () => {
      setIsChatLoading(false);
    },
  });

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!askQuery.trim()) return;
    chatMutation.mutate(askQuery);
  };

  // Helper to format model label
  const formatModelLabel = (modelString) => {
    if (!modelString) return "AI Engine";
    if (modelString.includes("gemini-2.0-flash")) return "Gemini 2.0 Flash";
    if (modelString.includes("gemini-flash-1.5")) return "Gemini 1.5 Flash";
    if (modelString.includes("llama-3.1-8b")) return "Llama 3.1 8B Free";
    return modelString;
  };

  return (
    <div className="space-y-6">
      
      {/* SECTION 1: Natural Language Query "Hero Feature" */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/40 p-6 shadow-sm">
        <div className="flex items-center space-x-2 text-primary mb-3">
          <HelpCircle className="h-5 w-5" />
          <h3 className="text-lg font-bold text-slate-800">Ask FinanceFlow AI</h3>
        </div>
        
        <p className="text-xs text-slate-500 mb-4">
          Query details about your transactions in plain English (e.g. "Identify how much I spent on groceries").
        </p>

        <form onSubmit={handleChatSubmit} className="flex gap-2">
          <input
            type="text"
            value={askQuery}
            onChange={(e) => setAskQuery(e.target.value)}
            placeholder="Ask about your spending behavior..."
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={isChatLoading || !askQuery.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/25 hover:bg-indigo-600 disabled:opacity-50 transition-all"
          >
            {isChatLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>

        {/* NLQ Chat Error State */}
        {chatError && (
          <div className="mt-4 flex items-center space-x-2 rounded-xl bg-rose-50 p-4 border border-rose-100 text-xs text-rose-600 font-semibold animate-shake">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{chatError}</span>
          </div>
        )}

        {/* NLQ Chat Success State with Typewriter Reveal */}
        {chatResponse && (
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Response Output
              </span>
              <div className="flex items-center space-x-1.5 text-[10px] font-semibold text-slate-500">
                <Cpu className="h-3 w-3" />
                <span>{formatModelLabel(chatResponse.modelUsed)}</span>
              </div>
            </div>
            <div className="pt-1">
              <TypewriterEffect text={chatResponse.answer} />
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: 4-Card AI Insights Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-800">Financial Insights</h3>
          </div>
          {report && (
            <span className="inline-flex items-center space-x-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-100">
              <Cpu className="h-3 w-3" />
              <span>{formatModelLabel(report.modelUsed)}</span>
            </span>
          )}
        </div>

        {/* ERROR STATE */}
        {reportError && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-5 flex items-start space-x-3 text-rose-700">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-bold text-sm">Failed to generate insights</h4>
              <p className="text-xs leading-relaxed opacity-90">{reportError.message}</p>
              <button
                onClick={() => refetchReport()}
                className="mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* LOADING SKELETON STATE */}
        {isReportLoading && (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 rounded bg-slate-200"></div>
                  <div className="h-8 w-8 rounded-lg bg-slate-100"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-slate-200"></div>
                  <div className="h-3 w-5/6 rounded bg-slate-200"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REPORT CONTENT DATA */}
        {report && !isReportLoading && !reportError && (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            
            {/* Card 1: Pattern */}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/10 p-5 flex flex-col justify-between transition-all hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  Spending Pattern
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <TrendingUp className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-700">
                {report.pattern}
              </p>
            </div>

            {/* Card 2: Alert */}
            <div className="rounded-2xl border border-amber-100 bg-amber-50/10 p-5 flex flex-col justify-between transition-all hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Budget Alerts
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-700">
                {report.alert}
              </p>
            </div>

            {/* Card 3: Forecast */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/10 p-5 flex flex-col justify-between transition-all hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Savings Forecast
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <PiggyBank className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-700">
                {report.forecast}
              </p>
            </div>

            {/* Card 4: Anomaly */}
            <div className="rounded-2xl border border-purple-100 bg-purple-50/10 p-5 flex flex-col justify-between transition-all hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                  Anomalies Detected
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  <Eye className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-700">
                {report.anomaly}
              </p>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
