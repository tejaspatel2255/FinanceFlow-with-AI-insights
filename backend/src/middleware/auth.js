const { supabaseAdmin } = require("../config/supabase");

/**
 * Express middleware to authenticate and authorize requests using Supabase JWT.
 * Expects header: "Authorization: Bearer <Supabase JWT>"
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access Denied: No Bearer Token Provided." });
    }

    const token = authHeader.split(" ")[1];

    // Verify token using Supabase admin client
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Access Denied: Invalid or Expired Token." });
    }

    // Attach user payload to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({ error: "Internal Server Error during Authentication." });
  }
}

module.exports = { requireAuth };
