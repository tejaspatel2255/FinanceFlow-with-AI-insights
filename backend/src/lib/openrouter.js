require("dotenv").config();

// Robust fallback chain with corrected spelling, active free models, and auto-router
const FALLBACK_MODELS = [
  "google/gemini-2.0-flash-001",
  "google/gemini-flash-1.5",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "openrouter/free"
];

/**
 * Sends a chat completion query to OpenRouter with automated model failover.
 * 
 * @param {Array} messages - Chat completions message payload: [{role: 'user', content: '...'}]
 * @param {Object} options - Custom fetch options (temperature, max_tokens, etc.)
 * @returns {Promise<Object>} - Successful response object containing: { text, model }
 */
async function callOpenRouterWithFallback(messages, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY in server environment variables.");
  }

  const errors = [];

  for (const model of FALLBACK_MODELS) {
    try {
      console.log(`[OpenRouter] Attempting request using model: ${model}`);
      
      // Increased timeout to 20 seconds (20000ms) to prevent timeout aborts on slower free tier models
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://finance-flow-with-ai-insights.vercel.app",
          "X-Title": "FinanceFlow",
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.max_tokens ?? 1000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${errorData || response.statusText}`);
      }

      const responseJson = await response.json();
      const responseText = responseJson.choices?.[0]?.message?.content;

      if (!responseText) {
        throw new Error("Empty response choice returned from completions endpoint.");
      }

      console.log(`[OpenRouter] Success! Responded using model: ${model}`);
      return {
        text: responseText,
        model: model,
      };
    } catch (err) {
      const errorMsg = err.name === "AbortError" ? "Request timed out (20s limit)" : err.message;
      console.warn(`[OpenRouter] Model ${model} failed: ${errorMsg}`);
      errors.push({ model, error: errorMsg });
    }
  }

  // All models in the fallback chain failed
  const combinedErrorDetails = errors
    .map((e) => ` - ${e.model}: ${e.error}`)
    .join("\n");
  throw new Error(`All OpenRouter models failed to respond:\n${combinedErrorDetails}`);
}

module.exports = { callOpenRouterWithFallback };
