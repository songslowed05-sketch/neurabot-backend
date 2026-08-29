const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { askAI } = require("../services/aiService");

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/* =========================================================
   GET BUSINESS CONTEXT BY BUSINESS ID
========================================================= */

async function getBusinessContextByBusinessId(businessId) {
  if (!businessId) {
    throw new Error("Business ID is required.");
  }

  const {
    data: business,
    error: businessError,
  } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError) {
    console.error("BUSINESS QUERY ERROR:", businessError);
    throw new Error("Could not load business information.");
  }

  if (!business) {
    throw new Error("Business information not found.");
  }

  const {
    data: items,
    error: itemsError,
  } = await supabase
    .from("business_items")
    .select("id, name, price, description")
    .eq("business_id", businessId)
    .order("created_at", {
      ascending: true,
    });

  if (itemsError) {
    console.error("ITEMS QUERY ERROR:", itemsError);
    throw new Error(
      "Could not load business products and services."
    );
  }

  return {
    business: {
      id: business.id,
      name: business.name || "",
      category: business.category || "",
      location: business.location || "",
      phone: business.phone || "",
      email: business.email || "",
      website: business.website || "",
      openingTime: business.opening_time || "",
      closingTime: business.closing_time || "",
      mainInfo: business.main_info || "",
      customInfo: business.custom_info || "",
    },

    items: (items || []).map((item) => ({
      name: item.name || "",
      price:
        item.price !== null &&
        item.price !== undefined
          ? item.price
          : "",
      description: item.description || "",
    })),
  };
}

/* =========================================================
   GET ACTIVE SUBSCRIPTION
========================================================= */

async function getActiveSubscription(businessId) {
  const {
    data: subscription,
    error,
  } = await supabase
    .from("subscriptions")
    .select(`
      id,
      user_id,
      business_id,
      plan_id,
      plan_name,
      amount,
      status,
      started_at,
      expires_at
    `)
    .eq("business_id", businessId)
    .order("expires_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("SUBSCRIPTION QUERY ERROR:", error);

    throw new Error(
      "Could not verify subscription."
    );
  }

  if (!subscription) {
    return {
      active: false,
      code: "SUBSCRIPTION_REQUIRED",
      subscription: null,
    };
  }

  if (subscription.status !== "active") {
    return {
      active: false,
      code: "SUBSCRIPTION_INACTIVE",
      subscription,
    };
  }

  if (!subscription.expires_at) {
    return {
      active: false,
      code: "SUBSCRIPTION_INVALID",
      subscription,
    };
  }

  const expiresAt = new Date(
    subscription.expires_at
  );

  if (Number.isNaN(expiresAt.getTime())) {
    return {
      active: false,
      code: "SUBSCRIPTION_INVALID",
      subscription,
    };
  }

  if (expiresAt <= new Date()) {
    await supabase
      .from("subscriptions")
      .update({
        status: "expired",
      })
      .eq("id", subscription.id);

    return {
      active: false,
      code: "SUBSCRIPTION_EXPIRED",
      subscription: {
        ...subscription,
        status: "expired",
      },
    };
  }

  return {
    active: true,
    code: "ACTIVE",
    subscription,
  };
}

/* =========================================================
   PUBLIC WEBSITE CHATBOT
========================================================= */

router.post("/chat", async (req, res) => {
  try {
    const {
      businessId,
      message,
    } = req.body;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business ID is required.",
      });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      });
    }

    const cleanMessage = String(message).trim();

    console.log("=================================");
    console.log("NEURABOT WEBSITE REQUEST");
    console.log("BUSINESS ID:", businessId);
    console.log("MESSAGE:", cleanMessage);
    console.log("=================================");

    /* =====================================================
       VERIFY BUSINESS
    ===================================================== */

    const {
      data: business,
      error: businessError,
    } = await supabase
      .from("businesses")
      .select("id, name, category")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error(
        "WIDGET BUSINESS ERROR:",
        businessError
      );

      return res.status(500).json({
        success: false,
        message: "Could not verify business.",
      });
    }

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found.",
      });
    }

    /* =====================================================
       CHECK SUBSCRIPTION
    ===================================================== */

    const subscriptionResult =
      await getActiveSubscription(businessId);

    if (!subscriptionResult.active) {
      return res.status(403).json({
        success: false,
        code: subscriptionResult.code,
        message:
          subscriptionResult.code ===
          "SUBSCRIPTION_EXPIRED"
            ? "This NeuraBot subscription has expired."
            : "This NeuraBot is currently inactive.",
      });
    }

    /* =====================================================
       LOAD BUSINESS KNOWLEDGE
    ===================================================== */

    const businessContext =
      await getBusinessContextByBusinessId(
        businessId
      );

    console.log(
      "AI BUSINESS CONTEXT READY:",
      {
        businessId,
        businessName:
          businessContext.business.name,
        itemsCount:
          businessContext.items.length,
      }
    );

    /* =====================================================
       ASK AI
    ===================================================== */

    const answer = await askAI(
      businessContext,
      cleanMessage
    );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.json({
      success: true,
      answer,

      business: {
        id: business.id,
        name: business.name,
        category: business.category,
      },

      subscription: {
        plan:
          subscriptionResult.subscription
            .plan_name,

        expiresAt:
          subscriptionResult.subscription
            .expires_at,
      },
    });
  } catch (error) {
    console.error(
      "NEURABOT CHAT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "NeuraBot could not process your request.",
    });
  }
});

/* =========================================================
   WIDGET STATUS
========================================================= */

router.get("/status", async (req, res) => {
  try {
    const businessId =
      req.query.businessId;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business ID is required.",
      });
    }

    const {
      data: business,
      error: businessError,
    } = await supabase
      .from("businesses")
      .select("id, name, category")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      return res.status(500).json({
        success: false,
        message: "Could not verify business.",
      });
    }

    if (!business) {
      return res.status(404).json({
        success: false,
        active: false,
        code: "BUSINESS_NOT_FOUND",
        message: "Business not found.",
      });
    }

    const subscriptionResult =
      await getActiveSubscription(
        businessId
      );

    return res.json({
      success: true,
      active: subscriptionResult.active,
      code: subscriptionResult.code,

      business: {
        id: business.id,
        name: business.name,
        category: business.category,
      },

      subscription:
        subscriptionResult.subscription,
    });
  } catch (error) {
    console.error(
      "WIDGET STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      active: false,
      message:
        "Could not check widget status.",
    });
  }
});

/* =========================================================
   INSTALLATION CODE
========================================================= */

router.get("/code", async (req, res) => {
  try {
    const businessId =
      req.query.businessId;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business ID is required.",
      });
    }

    /* =====================================================
       BUSINESS
    ===================================================== */

    const {
      data: business,
      error: businessError,
    } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error(
        "INSTALL BUSINESS ERROR:",
        businessError
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not verify business.",
      });
    }

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found.",
      });
    }

    /* =====================================================
       SUBSCRIPTION
    ===================================================== */

    const subscriptionResult =
      await getActiveSubscription(
        businessId
      );

    if (!subscriptionResult.active) {
      return res.status(403).json({
        success: false,
        code:
          subscriptionResult.code,
        message:
          "An active subscription is required before installing NeuraBot.",
      });
    }

    /* =====================================================
       BACKEND URL
    ===================================================== */

    const apiUrl =
      process.env.PUBLIC_API_URL ||
      process.env.API_URL ||
      "http://localhost:5000";

    /* =====================================================
       WIDGET SCRIPT
    ===================================================== */

    const scriptUrl =
      `${apiUrl}/widget/neura-bot.js`;

    /* =====================================================
       INSTALLATION CODE
    ===================================================== */

    const code =
`<script
  src="${scriptUrl}"
  data-neura-business="${business.id}"
  data-neura-api="${apiUrl}"
  defer
></script>`;

    return res.json({
      success: true,

      business: {
        id: business.id,
        name: business.name,
      },

      subscription: {
        plan:
          subscriptionResult.subscription
            .plan_name,

        expiresAt:
          subscriptionResult.subscription
            .expires_at,
      },

      scriptUrl,
      code,
    });
  } catch (error) {
    console.error(
      "INSTALL CODE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Could not generate installation code.",
    });
  }
});

module.exports = router;