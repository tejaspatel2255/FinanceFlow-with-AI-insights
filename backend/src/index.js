const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { z } = require("zod");
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

// In-memory cache for exchange rates
const exchangeRateCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Helper to fetch/convert currency
async function getExchangeRate(from, to) {
  if (from === to) return 1.0;
  const cacheKey = `${from}_${to}`;
  const cached = exchangeRateCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.rate;
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (!res.ok) throw new Error("Failed to fetch exchange rates");
    const data = await res.json();
    const rate = data.rates?.[to];
    if (!rate) throw new Error(`Currency ${to} not found in rates for ${from}`);

    // Store in cache
    exchangeRateCache.set(cacheKey, { rate, timestamp: Date.now() });
    // Also cache the reverse
    exchangeRateCache.set(`${to}_${from}`, { rate: 1 / rate, timestamp: Date.now() });

    return rate;
  } catch (err) {
    console.error("Exchange rate fetch error:", err);
    throw err;
  }
}

// Helper to get home currency for a user
async function getUserHomeCurrency(userId) {
  try {
    const { data: settings } = await supabaseAdmin
      .from("user_settings")
      .select("home_currency")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    return settings?.home_currency || "INR";
  } catch (err) {
    return "INR";
  }
}

function getCurrencySymbol(currency) {
  const symbols = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    AED: "د.إ",
    JPY: "¥"
  };
  return symbols[currency?.toUpperCase()] || currency || "₹";
}

async function getUserHomeCurrencySymbol(userId) {
  const currency = await getUserHomeCurrency(userId);
  return getCurrencySymbol(currency);
}

// Zod Schema for NLQ Quick Add
const QuickAddSingleSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(["income", "expense"]),
  category: z.enum([
    "housing",
    "groceries",
    "utilities",
    "entertainment",
    "transportation",
    "insurance",
    "salary",
    "freelance",
    "investments",
    "other"
  ]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  description: z.string().max(255).default("Quick add transaction")
});

const QuickAddSchema = z.array(QuickAddSingleSchema);

// Reusable notifications checker functions
async function checkAndTriggerTransactionNotifications(tx) {
  const userId = tx.user_id;

  // 1. Budget Exceeded check
  try {
    const monthStart = new Date(tx.date);
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split("T")[0];

    // Get the budget for this category
    const { data: budget } = await supabaseAdmin
      .from("budgets")
      .select("*")
      .eq("user_id", userId)
      .eq("category", tx.category)
      .eq("period", "monthly")
      .limit(1)
      .maybeSingle();

    if (budget) {
      // Sum expenses in this category for this month (converting foreign amounts to home)
      const { data: monthTxs } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("category", tx.category)
        .eq("type", "expense")
        .gte("date", monthStartStr);

      let totalExpensesInHome = 0;
      if (monthTxs) {
        totalExpensesInHome = monthTxs.reduce((sum, t) => {
          const rate = t.exchange_rate_to_home || 1.0;
          return sum + (Number(t.amount) * rate);
        }, 0);
      }

      const budgetAmount = Number(budget.amount);
      const ratio = totalExpensesInHome / budgetAmount;

      // Determine if they crossed 85% or 100%
      let thresholdCrossed = null;
      if (ratio >= 1.0) {
        thresholdCrossed = 100;
      } else if (ratio >= 0.85) {
        thresholdCrossed = 85;
      }

      if (thresholdCrossed) {
        // Check if we already sent a notification for this threshold, this category, and this month
        const titleQuery = thresholdCrossed === 100 
          ? `Budget Exceeded: ${tx.category}` 
          : `Budget Warning (85%): ${tx.category}`;

        const { data: existingNotif } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "budget_exceeded")
          .eq("title", titleQuery)
          .gte("created_at", monthStartStr)
          .limit(1)
          .maybeSingle();

        if (!existingNotif) {
          const homeSymbol = await getUserHomeCurrencySymbol(userId);
          const formattedTotal = totalExpensesInHome.toLocaleString("en-IN", { maximumFractionDigits: 2 });
          const formattedBudget = budgetAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 });

          await supabaseAdmin.from("notifications").insert({
            user_id: userId,
            type: "budget_exceeded",
            title: titleQuery,
            message: thresholdCrossed === 100 
              ? `You have exceeded your ${tx.category} budget! Spent: ${homeSymbol}${formattedTotal} of ${homeSymbol}${formattedBudget}.`
              : `You have spent over 85% of your ${tx.category} budget! Spent: ${homeSymbol}${formattedTotal} of ${homeSymbol}${formattedBudget}.`,
            related_id: budget.id
          });
        }
      }
    }
  } catch (err) {
    console.error("Error in budget exceeded notification check:", err);
  }

  // 2. Large Transaction check (amount > 2x average transaction size in that category over the last 3 months)
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split("T")[0];

    const { data: prevTxs } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("category", tx.category)
      .eq("type", tx.type)
      .gte("date", threeMonthsAgoStr);

    if (prevTxs && prevTxs.length > 3) {
      const sum = prevTxs.reduce((acc, t) => acc + (Number(t.amount) * (t.exchange_rate_to_home || 1.0)), 0);
      const avg = sum / prevTxs.length;
      const currentTxInHome = Number(tx.amount) * (tx.exchange_rate_to_home || 1.0);

      if (currentTxInHome > 2 * avg) {
        const homeSymbol = await getUserHomeCurrencySymbol(userId);
        const formattedAmount = currentTxInHome.toLocaleString("en-IN", { maximumFractionDigits: 2 });
        const formattedAvg = avg.toLocaleString("en-IN", { maximumFractionDigits: 2 });

        await supabaseAdmin.from("notifications").insert({
          user_id: userId,
          type: "large_transaction",
          title: `Large Transaction in ${tx.category}`,
          message: `A transaction of ${homeSymbol}${formattedAmount} is more than double your 3-month average (${homeSymbol}${formattedAvg}) for ${tx.category}.`,
          related_id: tx.id
        });
      }
    }
  } catch (err) {
    console.error("Error in large transaction notification check:", err);
  }
}

function aiRateLimiter(req, res, next) {
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

    // Fetch user home currency using the helper function
    const homeCurrency = await getUserHomeCurrency(userId);
    const currencySymbol = getCurrencySymbol(homeCurrency);

    const { data: budgets = [] } = await supabaseAdmin
      .from("budgets")
      .select("*")
      .eq("user_id", userId);

    console.log(`[Cache Miss/Expired] Querying OpenRouter for user: ${userId} (${homeCurrency})`);

    const txSummary = transactions.slice(0, 30).map(t => {
      const sym = getCurrencySymbol(t.currency || "INR");
      return `- ${t.date}: ${t.type} of ${sym}${t.amount} in '${t.category}' (${t.description || "N/A"})`;
    }).join("\n");

    const budgetSummary = budgets.map(b => 
      `- '${b.category}': Limit ${currencySymbol}${b.amount}/${b.period}`
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
All monetary amounts in your response MUST be written using the currency symbol ${currencySymbol} (currency code: ${homeCurrency}). Do NOT use $ or any other symbol unless ${homeCurrency} is actually USD. Format amounts naturally for that currency (e.g. ${currencySymbol}1,000, and use local numbering/formatting conventions where relevant).

Analyze this and output a JSON object. You MUST respond with ONLY a valid raw JSON object. 
Do not wrap it in markdown code blocks like \`\`\`json. Do not include preambles.

The JSON object must have exactly these keys:
- "pattern": 1 sentence summarizing their top spending trend in ${currencySymbol}.
- "alert": 1 sentence highlighting a budget overrun, high spending category, or caution in ${currencySymbol}.
- "forecast": 1 sentence describing their year-end savings trajectory in ${currencySymbol} based on these numbers.
- "anomaly": 1 sentence identifying any suspicious, anomalous, or unusual transaction size or recurring cost in ${currencySymbol} (or a positive savings indicator if none found).

JSON Format:
{
  "pattern": "your sentence here in ${currencySymbol}",
  "alert": "your sentence here in ${currencySymbol}",
  "forecast": "your sentence here in ${currencySymbol}",
  "anomaly": "your sentence here in ${currencySymbol}"
}
`;

    const result = await callOpenRouterWithFallback([
      { role: "system", content: `You are a specialized JSON finance agent who only communicates using the ${homeCurrency} currency symbol (${currencySymbol}).` },
      { role: "user", content: prompt }
    ]);

    let rawText = result.text.trim();
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(rawText);
    } catch (e) {
      // Robust fallback JSON parsing using regex matching
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch (innerError) {
          throw new Error("Failed to parse AI response: " + innerError.message);
        }
      } else {
        throw new Error("Invalid JSON format in AI response: " + e.message);
      }
    }

    // Safety net post-process: Replace stray "$" followed by digits with the correct symbol
    const sanitizeStrayDollars = (text, targetSymbol) => {
      if (!text) return "";
      if (targetSymbol === "$") return text;
      return text.replace(/\$\s?(\d+([.,]\d+)*)/g, `${targetSymbol}$1`);
    };

    const parsedPayload = {
      pattern: sanitizeStrayDollars(parsedData.pattern || "N/A", currencySymbol),
      alert: sanitizeStrayDollars(parsedData.alert || "N/A", currencySymbol),
      forecast: sanitizeStrayDollars(parsedData.forecast || "N/A", currencySymbol),
      anomaly: sanitizeStrayDollars(parsedData.anomaly || "N/A", currencySymbol),
      modelUsed: result.model
    };

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

    const txSummary = transactions.slice(0, 30).map(t => 
      `- ${t.date}: ${t.type} of ₹${t.amount} in '${t.category}' (${t.description || "N/A"})`
    ).join("\n");

    const prompt = `
You are helpful personal finance assistant.
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

// ----------------------------------------------------------------------------
// SAVINGS GOALS TRACKER ENDPOINTS
// ----------------------------------------------------------------------------

app.get("/api/goals", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: goals, error } = await supabaseAdmin
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(goals);
  } catch (error) {
    console.error("Fetch Goals Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch goals" });
  }
});

app.post("/api/goals", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, target_amount, current_amount = 0, deadline } = req.body;

    if (!name || !target_amount) {
      return res.status(400).json({ error: "Goal name and target amount are required" });
    }

    const { data: goal, error } = await supabaseAdmin
      .from("goals")
      .insert({
        user_id: userId,
        name,
        target_amount: parseFloat(target_amount),
        current_amount: parseFloat(current_amount),
        deadline: deadline || null
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(goal);
  } catch (error) {
    console.error("Create Goal Error:", error);
    res.status(500).json({ error: error.message || "Failed to create goal" });
  }
});

app.put("/api/goals/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, target_amount, current_amount, deadline } = req.body;

    const { data: oldGoal } = await supabaseAdmin
      .from("goals")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    const updatePayload = {};
    if (name !== undefined) updatePayload.name = name;
    if (target_amount !== undefined) updatePayload.target_amount = parseFloat(target_amount);
    if (current_amount !== undefined) updatePayload.current_amount = parseFloat(current_amount);
    if (deadline !== undefined) updatePayload.deadline = deadline || null;

    const { data: goal, error } = await supabaseAdmin
      .from("goals")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;

    // Check goal milestones reached
    if (oldGoal && goal) {
      const oldRatio = Number(oldGoal.current_amount) / Number(oldGoal.target_amount);
      const newRatio = Number(goal.current_amount) / Number(goal.target_amount);

      const thresholds = [0.25, 0.50, 0.75, 1.0];
      for (const t of thresholds) {
        if (oldRatio < t && newRatio >= t) {
          const percent = t * 100;
          await supabaseAdmin.from("notifications").insert({
            user_id: userId,
            type: "goal_milestone",
            title: `Goal Milestone: ${percent}% reached!`,
            message: `Congratulations! You have reached ${percent}% of your goal "${goal.name}".`,
            related_id: goal.id
          });
        }
      }
    }

    res.json(goal);
  } catch (error) {
    console.error("Update Goal Error:", error);
    res.status(500).json({ error: error.message || "Failed to update goal" });
  }
});

app.delete("/api/goals/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: goal, error } = await supabaseAdmin
      .from("goals")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: "Goal deleted successfully", goal });
  } catch (error) {
    console.error("Delete Goal Error:", error);
    res.status(500).json({ error: error.message || "Failed to delete goal" });
  }
});

app.get("/api/goals/:id/forecast", requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: goal, error: goalError } = await supabaseAdmin
      .from("goals")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (goalError || !goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateLimit = threeMonthsAgo.toISOString().split("T")[0];

    const { data: transactions = [] } = await supabaseAdmin
      .from("transactions")
      .select("amount, type")
      .eq("user_id", userId)
      .gte("date", dateLimit);

    let totalIncome = 0;
    transactions.forEach((tx) => {
      if (tx.type === "income") totalIncome += Number(tx.amount);
      else totalIncome -= Number(tx.amount);
    });

    const netSavings = Math.max(0, totalIncome);
    const monthlySavingsRate = Math.max(0, netSavings / 3);

    const prompt = `
Goal details:
- Name: "${goal.name}"
- Target Amount: ₹${goal.target_amount}
- Current Amount Saved: ₹${goal.current_amount}
- Target Deadline: ${goal.deadline || "None set"}

User's Average Monthly Savings Rate: ₹${monthlySavingsRate.toFixed(2)}/month.

Provide a single, short sentence (max 15 words) in Indian Rupees (₹) analyzing if they will hit the goal by the deadline at their current pace.
Examples:
- "At your current pace, you'll reach this goal 12 days early!"
- "You're behind — increase monthly savings by ₹2,000 to hit this on time."
- "With no monthly savings, it will be impossible to reach your target on time."

Return ONLY the raw sentence. No quotation marks, no preamble, and no markdown blocks.
`;

    const result = await callOpenRouterWithFallback([
      { role: "system", content: "You are a professional financial goal planner assistant." },
      { role: "user", content: prompt }
    ]);

    res.json({ forecast: result.text.trim() });
  } catch (error) {
    console.error("Goal Forecast Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate goal forecast" });
  }
});

// ----------------------------------------------------------------------------
// TRANSACTIONS AND EXCHANGE RATE ENDPOINTS
// ----------------------------------------------------------------------------

// GET /api/exchange-rate - Fetch exchange rates with 1 hour caching
app.get("/api/exchange-rate", requireAuth, async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: "Missing 'from' or 'to' currency parameters" });
  }
  try {
    const rate = await getExchangeRate(from.toUpperCase(), to.toUpperCase());
    res.json({ rate });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch exchange rate" });
  }
});

// POST /api/transactions - Create transaction (multi-currency conversion, notifications triggers)
app.post("/api/transactions", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      amount, 
      type, 
      category, 
      date, 
      description, 
      tags = [], 
      currency = "INR", 
      is_recurring = false,
      recurrence_frequency = null,
      recurrence_interval_days = null,
      recurrence_end_date = null,
      parent_transaction_id = null
    } = req.body;

    if (!amount || !type || !category) {
      return res.status(400).json({ error: "Amount, type, and category are required" });
    }

    const homeCurrency = await getUserHomeCurrency(userId);

    let exchangeRate = 1.0;
    if (currency.toUpperCase() !== homeCurrency.toUpperCase()) {
      try {
        exchangeRate = await getExchangeRate(currency.toUpperCase(), homeCurrency.toUpperCase());
      } catch (err) {
        console.warn("Failed to fetch live exchange rate, falling back to 1.0:", err);
      }
    }

    const { data: transaction, error } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: userId,
        amount: parseFloat(amount),
        type,
        category,
        date: date || new Date().toISOString().split("T")[0],
        description,
        tags,
        currency: currency.toUpperCase(),
        exchange_rate_to_home: exchangeRate,
        is_recurring,
        recurrence_frequency,
        recurrence_interval_days: is_recurring && recurrence_frequency === "custom" ? Number(recurrence_interval_days) : null,
        recurrence_end_date,
        parent_transaction_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Trigger notification alerts on transaction creation
    await checkAndTriggerTransactionNotifications(transaction);

    res.status(201).json(transaction);
  } catch (error) {
    console.error("Create Transaction Error:", error);
    res.status(500).json({ error: error.message || "Failed to create transaction" });
  }
});

// POST /api/transactions/generate-recurring - Template engine
app.post("/api/transactions/generate-recurring", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: templates, error: templateError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("is_recurring", true)
      .is("parent_transaction_id", null)
      .eq("user_id", userId);

    if (templateError) throw templateError;

    const generated = [];

    for (const template of templates) {
      let refDate = template.last_generated_recurring 
        ? new Date(template.last_generated_recurring) 
        : new Date(template.date);
         
      const endDate = template.recurrence_end_date ? new Date(template.recurrence_end_date) : null;
      const today = new Date();
      today.setHours(0,0,0,0);

      let nextDate = calculateNextDate(refDate, template.recurrence_frequency, template.recurrence_interval_days);

      // Alert if recurring transaction is due within 3 days (once)
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(0,0,0,0);

      if (nextDate <= threeDaysFromNow && nextDate > today) {
        const nextDateStr = nextDate.toISOString().split("T")[0];
        const { data: existingNotif } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("user_id", template.user_id)
          .eq("type", "recurring_due")
          .eq("related_id", template.id)
          .like("message", `%${nextDateStr}%`)
          .limit(1)
          .maybeSingle();

        if (!existingNotif) {
          const homeSymbol = await getUserHomeCurrencySymbol(template.user_id);
          const amountInHome = Number(template.amount) * (template.exchange_rate_to_home || 1.0);
          const formattedAmount = amountInHome.toLocaleString("en-IN", { maximumFractionDigits: 2 });
           
          await supabaseAdmin.from("notifications").insert({
            user_id: template.user_id,
            type: "recurring_due",
            title: `Upcoming Recurring Bill`,
            message: `Your recurring transaction "${template.description || "Bill"}" of ${homeSymbol}${formattedAmount} is due on ${nextDateStr}.`,
            related_id: template.id
          });
        }
      }

      while (nextDate <= today) {
        if (endDate && nextDate > endDate) {
          break;
        }

        const dateStr = nextDate.toISOString().split("T")[0];

        const { data: existing, error: existError } = await supabaseAdmin
          .from("transactions")
          .select("id")
          .eq("parent_transaction_id", template.id)
          .eq("date", dateStr)
          .limit(1)
          .maybeSingle();

        if (!existing && !existError) {
          const { data: newTx, error: insertError } = await supabaseAdmin
            .from("transactions")
            .insert({
              user_id: template.user_id,
              amount: template.amount,
              type: template.type,
              category: template.category,
              description: template.description,
              tags: template.tags,
              date: dateStr,
              currency: template.currency || "INR",
              exchange_rate_to_home: template.exchange_rate_to_home || 1.0,
              is_recurring: false,
              parent_transaction_id: template.id,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) {
            console.error("Failed to generate recurring transaction:", insertError);
          } else {
            generated.push(newTx);
            await checkAndTriggerTransactionNotifications(newTx);
          }
        }

        await supabaseAdmin
          .from("transactions")
          .update({ last_generated_recurring: dateStr })
          .eq("id", template.id);

        refDate = nextDate;
        nextDate = calculateNextDate(refDate, template.recurrence_frequency, template.recurrence_interval_days);
      }
    }

    res.json({ success: true, generatedCount: generated.length, generated });
  } catch (err) {
    console.error("Generate recurring error:", err);
    res.status(500).json({ error: err.message || "Failed to generate recurring transactions" });
  }
});

function calculateNextDate(date, frequency, intervalDays) {
  const next = new Date(date);
  if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (frequency === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else if (frequency === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  } else if (frequency === "custom" && intervalDays) {
    next.setDate(next.getDate() + Number(intervalDays));
  }
  return next;
}

// POST /api/transactions/quick-add - NLP Extraction via OpenRouter
app.post("/api/transactions/quick-add", requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text prompt is required" });
    }

    const userId = req.user.id;
    const homeCurrency = await getUserHomeCurrency(userId);
    const todayStr = new Date().toISOString().split("T")[0];

    const prompt = `
You are an expert personal finance assistant.
Extract transaction details from this unstructured text:
"${text}"

Reference date (Today): ${todayStr}
User's Home Currency Code: ${homeCurrency}

Select exactly one category from this fixed list:
- housing
- groceries
- utilities
- entertainment
- transportation
- insurance
- salary
- freelance
- investments
- other

Resolve relative dates (e.g. "yesterday", "today", "last Monday", "2 days ago") into actual "YYYY-MM-DD" format using the reference date. If no date is mentioned, default to today's date "${todayStr}".
Infer the type: "income" or "expense" (e.g. "spent", "paid", "bought" implies expense; "got", "received", "earned", "salary" implies income).

IMPORTANT INSTRUCTIONS:
1. Always return a JSON ARRAY containing one or more transaction objects, even if the input describes only a single transaction.
2. If the input describes multiple distinct transactions, return an array of transaction objects.
3. Return ONLY a valid raw JSON array with no markdown code blocks (do not wrap in \`\`\`json), no preamble, and no explanation text.

EXAMPLES:
---
Input: "spent 200 on lunch yesterday"
Output:
[
  {
    "amount": 200,
    "type": "expense",
    "category": "entertainment",
    "date": "YYYY-MM-DD", // Resolved yesterday's date
    "description": "Lunch"
  }
]

Input: "spent 500 on icecream and earned 1000 by making a project"
Output:
[
  {
    "amount": 500,
    "type": "expense",
    "category": "entertainment",
    "date": "${todayStr}",
    "description": "Icecream"
  },
  {
    "amount": 1000,
    "type": "income",
    "category": "freelance",
    "date": "${todayStr}",
    "description": "Project"
  }
]
---
`;

    const result = await callOpenRouterWithFallback([
      { role: "system", content: "You are a financial information extraction agent. You only output raw JSON arrays of objects." },
      { role: "user", content: prompt }
    ]);

    let rawText = result.text.trim();
    console.log("[Quick Add] Raw AI response text:", rawText);

    let parsedData;
    try {
      let cleanText = rawText;
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
      } else {
        // Fallback: extract JSON array or object using regex
        const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
        const objectMatch = cleanText.match(/\{[\s\S]*\}/);
        if (arrayMatch) {
          cleanText = arrayMatch[0];
        } else if (objectMatch) {
          cleanText = objectMatch[0];
        }
      }
      parsedData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error("[Quick Add] AI response wasn't valid JSON. Error:", parseError.message);
      return res.status(422).json({
        error: "AI response was not valid JSON. Please try again or enter manually.",
        details: parseError.message
      });
    }

    let rawArray = [];
    if (Array.isArray(parsedData)) {
      rawArray = parsedData;
    } else if (parsedData && Array.isArray(parsedData.transactions)) {
      rawArray = parsedData.transactions;
    } else if (parsedData && typeof parsedData === "object") {
      rawArray = [parsedData];
    }

    const processedArray = rawArray.map(item => ({
      ...item,
      amount: item.amount ? parseFloat(item.amount) : undefined
    }));

    const validated = QuickAddSchema.safeParse(processedArray);

    if (!validated.success) {
      console.error("[Quick Add] Zod validation failed for quick-add extraction:", JSON.stringify(validated.error.errors, null, 2));
      return res.status(422).json({ 
        error: "AI response was JSON but missing or having invalid required fields.", 
        details: validated.error.errors 
      });
    }

    res.json({ transactions: validated.data });
  } catch (error) {
    console.error("Quick Add Extraction Error:", error);
    res.status(500).json({ error: error.message || "All OpenRouter models in the fallback chain failed." });
  }
});

// ----------------------------------------------------------------------------
// NOTIFICATIONS ENDPOINTS
// ----------------------------------------------------------------------------

// GET /api/notifications
app.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: list, error: listError } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (listError) throw listError;

    const { count, error: countError } = await supabaseAdmin
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (countError) throw countError;

    res.json({ notifications: list || [], unreadCount: count || 0 });
  } catch (err) {
    console.error("Fetch notifications error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch notifications" });
  }
});

// PUT /api/notifications/:id/read
app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Read notification error:", err);
    res.status(500).json({ error: err.message || "Failed to update notification" });
  }
});

// PUT /api/notifications/read-all
app.put("/api/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .select();

    if (error) throw error;
    res.json({ success: true, count: data?.length || 0 });
  } catch (err) {
    console.error("Read all notifications error:", err);
    res.status(500).json({ error: err.message || "Failed to mark notifications as read" });
  }
});

// ----------------------------------------------------------------------------
// CSV BULK IMPORT ENDPOINT
// ----------------------------------------------------------------------------
app.post("/api/transactions/bulk-import", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactions = [] } = req.body;

    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: "Invalid payload: transactions must be an array" });
    }

    if (transactions.length === 0) {
      return res.status(400).json({ error: "No transactions provided for import" });
    }

    if (transactions.length > 1000) {
      return res.status(400).json({ error: "Bulk import limit exceeded. Max 1000 rows allowed." });
    }

    const baseTime = Date.now();
    const rowsToInsert = transactions.map((tx, idx) => ({
      user_id: userId,
      amount: parseFloat(tx.amount),
      type: tx.type,
      category: tx.category || "other",
      date: tx.date,
      description: tx.description || null,
      tags: Array.isArray(tx.tags) ? tx.tags : [],
      created_at: new Date(baseTime + idx).toISOString()
    }));

    const { data, error } = await supabaseAdmin
      .from("transactions")
      .insert(rowsToInsert)
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      insertedCount: data.length,
      failedCount: rowsToInsert.length - data.length
    });
  } catch (error) {
    console.error("Bulk Import Error:", error);
    res.status(500).json({ error: error.message || "Failed to complete bulk import" });
  }
});

// ----------------------------------------------------------------------------
// AI AUTO-CATEGORIZATION ENDPOINT
// ----------------------------------------------------------------------------
const categoryCache = new Map();

app.post("/api/transactions/categorize", requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { description, descriptions } = req.body;

    const categoriesList = [
      "housing",
      "groceries",
      "utilities",
      "entertainment",
      "transportation",
      "insurance",
      "salary",
      "freelance",
      "investments",
      "other"
    ];

    if (Array.isArray(descriptions)) {
      if (descriptions.length === 0) {
        return res.json([]);
      }

      const results = {};
      const misses = [];

      descriptions.forEach((desc) => {
        if (!desc || typeof desc !== "string") return;
        const norm = desc.trim().toLowerCase();
        if (categoryCache.has(norm)) {
          results[desc] = categoryCache.get(norm);
        } else {
          misses.push(desc);
        }
      });

      if (misses.length > 0) {
        const batch = misses.slice(0, 50);

        const prompt = `
You are a financial classification agent.
Categorize this list of transaction descriptions:
${batch.map((d, index) => `${index + 1}. "${d}"`).join("\n")}

For each description, select exactly one category from this fixed list:
${categoriesList.map((c) => `- ${c}`).join("\n")}

Your response must be a single raw JSON array of objects with no markdown block formatting, no preamble, and no extra text.
The array length must be exactly ${batch.length}.
JSON structure:
[
  { "category": "category_name", "confidence": 0.0 to 1.0 },
  ...
]
`;

        const result = await callOpenRouterWithFallback([
          { role: "system", content: "You are a financial classification agent who outputs raw JSON arrays." },
          { role: "user", content: prompt }
        ]);

        let rawText = result.text.trim();
        if (rawText.startsWith("```")) {
          rawText = rawText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
        }

        const parsedArray = JSON.parse(rawText);

        if (Array.isArray(parsedArray)) {
          batch.forEach((desc, idx) => {
            const parsedItem = parsedArray[idx] || {};
            const categoryResult = {
              category: categoriesList.includes(parsedItem.category) ? parsedItem.category : "other",
              confidence: typeof parsedItem.confidence === "number" ? parsedItem.confidence : 0.5
            };
            const norm = desc.trim().toLowerCase();
            categoryCache.set(norm, categoryResult);
            results[desc] = categoryResult;
          });
        } else {
          batch.forEach((desc) => {
            const categoryResult = { category: "other", confidence: 0.1 };
            results[desc] = categoryResult;
          });
        }
      }

      const finalPayload = descriptions.map((desc) => {
        return {
          description: desc,
          ...(results[desc] || { category: "other", confidence: 0.1 })
        };
      });

      return res.json(finalPayload);
    }

    if (!description || typeof description !== "string") {
      return res.status(400).json({ error: "Transaction description or descriptions array is required" });
    }

    const normalizedDesc = description.trim().toLowerCase();

    if (categoryCache.has(normalizedDesc)) {
      console.log(`[Cache Hit] Returning auto-category for description: ${normalizedDesc}`);
      return res.json(categoryCache.get(normalizedDesc));
    }

    const prompt = `
You are an expert financial transaction classification assistant.
Categorize this transaction description: "${description}"

Select exactly one category from this fixed list:
${categoriesList.map((c) => `- ${c}`).join("\n")}

Your response must be a single raw JSON object with no markdown block formatting, no preamble, and no extra text.
JSON structure:
{
  "category": "one_of_the_above_categories",
  "confidence": 0.0 to 1.0
}
`;

    const result = await callOpenRouterWithFallback([
      { role: "system", content: "You are a financial classification agent." },
      { role: "user", content: prompt }
    ]);

    let rawText = result.text.trim();
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }

    const parsedData = JSON.parse(rawText);
    const categoryResult = {
      category: categoriesList.includes(parsedData.category) ? parsedData.category : "other",
      confidence: typeof parsedData.confidence === "number" ? parsedData.confidence : 0.5
    };

    categoryCache.set(normalizedDesc, categoryResult);

    res.json(categoryResult);
  } catch (error) {
    console.error("Auto Categorization Error:", error);
    res.status(500).json({ error: error.message || "Failed to auto-categorize transaction" });
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
