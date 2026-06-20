const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("Warning: GEMINI_API_KEY is not defined in the backend environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

/**
 * Generates financial insights using Gemini Flash model.
 * 
 * @param {Array} transactions - List of transactions
 * @param {Array} budgets - List of budgets
 * @param {Array} goals - List of savings goals
 * @returns {Promise<string>} - Textual insights and advice
 */
async function generateFinancialInsights(transactions, budgets, goals) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Format transaction, budget, and goals into a clean text prompt for the model
    const transactionsSummary = transactions.map(t => 
      `- ${t.date}: ${t.type.toUpperCase()} of $${t.amount} in '${t.category}' (Desc: ${t.description || "None"})`
    ).join("\n");

    const budgetsSummary = budgets.map(b => 
      `- Category '${b.category}': Limit of $${b.amount} per ${b.period}`
    ).join("\n");

    const goalsSummary = goals.map(g => 
      `- Goal '${g.name}': Target $${g.target_amount}, Current $${g.current_amount}, Deadline: ${g.deadline || "None"}`
    ).join("\n");

    const prompt = `
You are a highly qualified virtual personal finance advisor. 
Analyze the user's financial profile below and provide actionable, encouraging insights.
Focus on:
1. Category budget overruns or warnings.
2. Savings rate optimizations based on current goals.
3. Simple, actionable suggestions for spending less.

Keep your response professional, structured, and limited to 4-5 bullet points.

---
USER FINANCIAL PROFILE:

1. RECENT TRANSACTIONS:
${transactionsSummary || "No transaction data available yet."}

2. ACTIVE BUDGET LIMITS:
${budgetsSummary || "No active budgets set."}

3. SAVINGS GOALS:
${goalsSummary || "No active goals set."}
---

Your Actionable Financial Insights:
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating insights with Gemini API:", error);
    throw new Error("Failed to generate financial insights: " + error.message);
  }
}

module.exports = { generateFinancialInsights };
