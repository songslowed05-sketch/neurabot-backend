const express = require("express");
const jwt = require("jsonwebtoken");

const { getBusinessContext } = require("../services/businessContext");
const { askAI } = require("../services/aiService");

const router = express.Router();

/* =========================
   AUTHENTICATION
========================= */

function authenticate(req, res, next) {
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

    /*
     * IMPORTANT:
     * Login token mein userId hai.
     */

    const userId =
      decoded.userId ||
      decoded.id ||
      decoded.user_id ||
      decoded.sub;

    if (!userId) {
      return res.status(401).json({
        message: "User ID is missing from authentication token",
      });
    }

    req.user = {
      ...decoded,
      id: userId,
    };

    next();
  } catch (error) {
    console.error("AI AUTH ERROR:", error);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

/* =========================
   AI CHAT
========================= */

router.post("/chat", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        message: "Message is required",
      });
    }

    console.log("=================================");
    console.log("AI CHAT REQUEST");
    console.log("USER ID:", userId);
    console.log("MESSAGE:", message);
    console.log("=================================");

    /*
    -------------------------------------------------------
    GET ONLY THIS USER'S BUSINESS DATA
    -------------------------------------------------------
    */

    const businessContext =
      await getBusinessContext(userId);

    /*
    -------------------------------------------------------
    SEND ONLY THAT BUSINESS DATA TO AI
    -------------------------------------------------------
    */

    const answer = await askAI(
      businessContext,
      message
    );

    /*
    -------------------------------------------------------
    RESPONSE
    -------------------------------------------------------
    */

    return res.json({
      success: true,
      answer,
    });
  } catch (error) {
    console.error("AI CHAT ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "AI could not process your request",
    });
  }
});

module.exports = router;