const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

// Middleware imports
const { requireAuth } = require("./middleware/auth");
const { supabaseAdmin } = require("./config/supabase");

// Import OpenRouter helper
const { callOpenRouterWithFallback } = require("./lib/openrouter");

const app = express();
const PORT = process.env.PORT || 5000;

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ----------------------------------------------------------------------------
// Rate Limiter: Max 10 requests per user per hour
// ----------------------------------------------------------------------------
const rateLimitMap = new Map();

function aiRateLimiter(req, res, next) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  if (!rateLimitMap.has(userId)) {
    rateLimitMap.set(userId, []);
  }

  // Filter timestamps within the last 1 hour
  const userTimestamps = rateLimitMap.get(userId).filter(t => now - t < oneHour);
  userTimestamps.push(now);
  rateLimitMap.set(userId, userTimestamps);

  if (userTimestamps.length > 10) {
    return res.status(429).json({
      error: "Rate Limit Exceeded",
      message: "You have exceeded the limit of 10 AI reports per hour. Please wait a while before requesting again."
    });
  }

  next();
}

// Health Check Route
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development"
  });
});

// ----------------------------------------------------------------------------
// POST /api/insights - AI Insights Generation (Cached + Rate Limited)
// ----------------------------------------------------------------------------
app.post("/api/insights", requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactions = [] } = req.body;

    // 1. Check if the last cached insight is less than 24 hours old
    const { data: latestInsight, error: selectError } = await supabaseAdmin
      .from("ai_insights")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (latestInsight && (now - new Date(latestInsight.created_at).getTime()) < twentyFourHours) {
      console.log(`[Cache Hit] Serving cached insight for user: ${userId}`);
      try {
        const cachedPayload = JSON.parse(latestInsight.insight_text);
        return res.status(200).json({
          success: true,
          insight: {
            id: latestInsight.id,
            user_id: latestInsight.user_id,
            created_at: latestInsight.created_at,
            ...cachedPayload
          }
        });
      } catch (parseError) {
        console.warn("Failed to parse cached insight JSON. Regenerating insights.");
      }
    }

    // 2. Fetch budgets to give context to prompt
    const { data: budgets = [] } = await supabaseAdmin
      .from("budgets")
      .select("*")
      .eq("user_id", userId);

    console.log(`[Cache Miss/Expired] Querying OpenRouter for user: ${userId}`);

    // 3. Build a structured prompt in INR currency
    const txSummary = transactions.slice(0, 30).map(t => 
      `- ${t.date}: ${t.type} of ₹${t.amount} in '${t.category}' (${t.description || "N/A"})`
    ).join("\n");

    const budgetSummary = budgets.map(b => 
      `- '${b.category}': Limit ₹${b.amount}/${b.period}`
    ).join("\n");

    const prompt = `
You are a professional financial assistant. 
Analyze the user's recent transactions and active budgets:

REPORTS / DATA:
---
TRANSACTIONS (Last 3 months, showing up to 30):
${txSummary || "None logged"}

ACTIVE BUDGETS:
${budgetSummary || "None set"}
---

IMPORTANT CURRENCY INSTRUCTION:
You MUST state all currency values in Indian Rupees (₹) and use Indian numbering formatting (lakhs/crores) where appropriate. 
NEVER use the dollar sign ($) or USD in your response under any circumstances. Replace all dollars with Indian Rupees (₹).

Analyze this and output a JSON object. You MUST respond with ONLY a valid raw JSON object. 
Do not wrap it in markdown code blocks like \`\`\`json. Do not include preambles.

The JSON object must have exactly these keys:
- "pattern": 1 sentence summarizing their top spending trend in ₹.
- "alert": 1 sentence highlighting a budget overrun, high spending category, or caution in ₹.
- "forecast": 1 sentence describing their year-end savings trajectory in ₹ based on these numbers.
- "anomaly": 1 sentence identifying any suspicious, anomalous, or unusual transaction size or recurring cost in ₹ (or a positive savings indicator if none found).

JSON Format:
{
  "pattern": "your sentence here in ₹",
  "alert": "your sentence here in ₹",
  "forecast": "your sentence here in ₹",
  "anomaly": "your sentence here in ₹"
}
`;

    // 4. Call OpenRouter with fallback chain
    const result = await callOpenRouterWithFallback([
      { role: "system", content: "You are a specialized JSON finance agent who only communicates using Indian Rupee (₹)." },
      { role: "user", content: prompt }
    ]);

    // Clean any markdown fences if present
    let rawText = result.text.trim();
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }

    const parsedData = JSON.parse(rawText);

    // Ensure it complies with expected fields
    const parsedPayload = {
      pattern: parsedData.pattern || "N/A",
      alert: parsedData.alert || "N/A",
      forecast: parsedData.forecast || "N/A",
      anomaly: parsedData.anomaly || "N/A",
      modelUsed: result.model
    };

    // 5. Store stringified JSON in the database
    const { data: insertedInsight, error: insertError } = await supabaseAdmin
      .from("ai_insights")
      .insert({
        user_id: userId,
        insight_text: JSON.stringify(parsedPayload)
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    res.status(201).json({
      success: true,
      insight: {
        id: insertedInsight.id,
        user_id: insertedInsight.user_id,
        created_at: insertedInsight.created_at,
        ...parsedPayload
      }
    });
  } catch (error) {
    console.error("AI Insights Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate report" });
  }
});

// ----------------------------------------------------------------------------
// POST /api/chat - Natural Language Query (Rate Limited)
// ----------------------------------------------------------------------------
app.post("/api/chat", requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { question, transactions = [] } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Missing query question" });
    }

    // Context summary
    const txSummary = transactions.slice(0, 30).map(t => 
      `- ${t.date}: ${t.type} of ₹${t.amount} in '${t.category}' (${t.description || "N/A"})`
    ).join("\n");

    const prompt = `
You are a helpful personal finance assistant.
Answer the user's question about their finances.

User's Question: "${question}"

User's Recent Transactions Context:
${txSummary || "No transaction logs available."}

IMPORTANT CURRENCY INSTRUCTION:
You MUST state all currency values in Indian Rupees (₹) and use Indian numbering formatting (lakhs/crores) where appropriate. 
NEVER use the dollar sign ($) or USD in your response under any circumstances. Replace all dollars with Indian Rupees (₹).

Provide a concise, friendly, and analytical answer in 2-3 sentences max. Focus on exact figures, categories, and dates if they are in the context.
`;

    const result = await callOpenRouterWithFallback([
      { role: "system", content: "You are a professional personal finance advisor who always uses Indian Rupee (₹)." },
      { role: "user", content: prompt }
    ]);

    res.status(200).json({
      answer: result.text,
      modelUsed: result.model
    });
  } catch (error) {
    console.error("Chat Query Error:", error);
    res.status(500).json({ error: error.message || "Failed to query finance assistant" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong on the server!" });
});

// Boot Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 FinanceFlow Backend running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`===================================================`);
});
