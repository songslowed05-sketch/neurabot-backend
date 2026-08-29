const express = require("express");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/* =========================================================
   AUTHENTICATION
========================================================= */

function authenticate(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token =
      authHeader.substring(7);

    const decoded =
      jwt.verify(
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
        success: false,
        message:
          "User ID missing from token",
      });
    }

    req.user = {
      ...decoded,
      id: userId,
    };

    next();

  } catch (error) {
    console.error(
      "WIDGET INSTALL AUTH ERROR:",
      error
    );

    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired token",
    });
  }
}

/* =========================================================
   GET INSTALLATION CODE
========================================================= */

router.get(
  "/code",
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user.id;

      /* -----------------------------------------
         FIND BUSINESS
      ----------------------------------------- */

      const {
        data: business,
        error: businessError,
      } = await supabase
        .from("businesses")
        .select("id, name")
        .eq("user_id", userId)
        .maybeSingle();

      if (businessError) {
        console.error(
          "INSTALL BUSINESS ERROR:",
          businessError
        );

        return res.status(500).json({
          success: false,
          message:
            businessError.message,
        });
      }

      if (!business) {
        return res.status(404).json({
          success: false,
          message:
            "Business not found.",
        });
      }

      /* -----------------------------------------
         CHECK SUBSCRIPTION
      ----------------------------------------- */

      const {
        data: subscription,
        error: subscriptionError,
      } = await supabase
        .from("subscriptions")
        .select(`
          id,
          status,
          plan_name,
          started_at,
          expires_at
        `)
        .eq(
          "business_id",
          business.id
        )
        .eq(
          "status",
          "active"
        )
        .order(
          "expires_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

      if (subscriptionError) {
        console.error(
          "INSTALL SUBSCRIPTION ERROR:",
          subscriptionError
        );

        return res.status(500).json({
          success: false,
          message:
            subscriptionError.message,
        });
      }

      if (!subscription) {
        return res.status(403).json({
          success: false,
          code:
            "SUBSCRIPTION_REQUIRED",
          message:
            "An active subscription is required.",
        });
      }

      /* -----------------------------------------
         EXPIRY
      ----------------------------------------- */

      const expiresAt =
        new Date(
          subscription.expires_at
        );

      if (
        !subscription.expires_at ||
        Number.isNaN(
          expiresAt.getTime()
        ) ||
        expiresAt <= new Date()
      ) {
        return res.status(403).json({
          success: false,
          code:
            "SUBSCRIPTION_EXPIRED",
          message:
            "Your subscription has expired.",
        });
      }

      /* -----------------------------------------
         API URL
      ----------------------------------------- */

     const apiUrl =
  process.env.PUBLIC_API_URL ||
  "https://neurabot-backend-ai-2335.vercel.app";

      /* -----------------------------------------
         INSTALLATION SNIPPET
      ----------------------------------------- */

      const installationCode =
`<script
  src="${apiUrl}/widget/neura-install.js"
  data-business-id="${business.id}"
  data-api="${apiUrl}"
  async
></script>`;

      /* -----------------------------------------
         RESPONSE
      ----------------------------------------- */

      return res.json({
        success: true,

        business: {
          id: business.id,
          name: business.name,
        },

        subscription: {
          plan:
            subscription.plan_name,
          startedAt:
            subscription.started_at,
          expiresAt:
            subscription.expires_at,
        },

        installationCode,
      });

    } catch (error) {
      console.error(
        "GET INSTALLATION CODE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not generate installation code.",
      });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

module.exports = router;