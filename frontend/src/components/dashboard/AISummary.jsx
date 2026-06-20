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

  return <span className="inline font-body text-sm text-foreground/90 leading-relaxed">{displayedText}</span>;
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
    <div className="space-y-6 font-body">
      
      {/* SECTION 1: Natural Language Query "Hero Feature" */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center space-x-2 text-primary mb-3">
          <HelpCircle className="h-5 w-5" />
          <h3 className="text-lg font-bold text-foreground font-display">Ask FinanceFlow AI</h3>
        </div>
        
        <p className="text-xs text-muted-foreground mb-4">
          Query details about your transactions in plain English (e.g. "Identify how much I spent on groceries").
        </p>

        <form onSubmit={handleChatSubmit} className="flex gap-2">
          <input
            type="text"
            value={askQuery}
            onChange={(e) => setAskQuery(e.target.value)}
            placeholder="Ask about your spending behavior..."
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={isChatLoading || !askQuery.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 hover:opacity-90 disabled:opacity-50 transition-all animate-transition"
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
          <div className="mt-4 flex items-center space-x-2 rounded-xl bg-destructive/10 p-4 border border-destructive/20 text-xs text-destructive font-semibold animate-shake">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{chatError}</span>
          </div>
        )}

        {/* NLQ Chat Success State with Typewriter Reveal */}
        {chatResponse && (
          <div className="mt-4 rounded-xl border border-border bg-secondary/35 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Response Output
              </span>
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
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <h3 className="text-lg font-bold text-foreground font-display">Financial Insights</h3>
          </div>
        </div>

        {/* ERROR STATE */}
        {reportError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 flex items-start space-x-3 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-bold text-sm">Failed to generate insights</h4>
              <p className="text-xs leading-relaxed opacity-90">{reportError.message}</p>
              <button
                onClick={() => refetchReport()}
                className="mt-2 rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground hover:opacity-90 transition-colors"
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
              <div key={i} className="animate-pulse rounded-2xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 rounded bg-secondary"></div>
                  <div className="h-8 w-8 rounded-lg bg-secondary/70"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-secondary"></div>
                  <div className="h-3 w-5/6 rounded bg-secondary"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REPORT CONTENT DATA */}
        {report && !isReportLoading && !reportError && (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            
            {/* Card 1: Pattern */}
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 flex flex-col justify-between transition-all hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase tracking-wider font-display">
                  Spending Pattern
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <TrendingUp className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold leading-relaxed text-foreground/90">
                {report.pattern}
              </p>
            </div>

            {/* Card 2: Alert */}
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5 flex flex-col justify-between transition-all hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-destructive uppercase tracking-wider font-display">
                  Budget Alerts
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold leading-relaxed text-foreground/90">
                {report.alert}
              </p>
            </div>

            {/* Card 3: Forecast */}
            <div className="rounded-2xl border border-success/25 bg-success/5 p-5 flex flex-col justify-between transition-all hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-success uppercase tracking-wider font-display">
                  Savings Forecast
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                  <PiggyBank className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold leading-relaxed text-foreground/90">
                {report.forecast}
              </p>
            </div>

            {/* Card 4: Anomaly */}
            <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between transition-all hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-display">
                  Anomalies Detected
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <Eye className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold leading-relaxed text-foreground/90">
                {report.anomaly}
              </p>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
