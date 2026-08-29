const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function adminAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const userId =
      decoded.userId ||
      decoded.id ||
      decoded.user_id ||
      decoded.sub;

    if (!userId) {
      return res.status(401).json({
        message: "User ID is missing from token",
      });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, full_name, email, role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("ADMIN USER ERROR:", error);

      return res.status(500).json({
        message: "Could not verify admin account",
      });
    }

    if (!user) {
      return res.status(404).json({
        message: "User account not found",
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    req.user = {
      ...decoded,
      id: user.id,
      role: user.role,
      email: user.email,
      fullName: user.full_name,
    };

    next();
  } catch (error) {
    console.error("ADMIN AUTH ERROR:", error);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

module.exports = {
  adminAuthenticate,
};