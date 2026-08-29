const express = require("express");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/* =========================================================
   PLAN CONFIG
========================================================= */

const PLAN_CONFIG = {
  monthly: {
    name: "Monthly",
    amount: 50,
    months: 1,
  },

  "six-months": {
    name: "6 Months",
    amount: 150,
    months: 6,
  },

  yearly: {
    name: "Yearly",
    amount: 300,
    months: 12,
  },
};

/* =========================================================
   AUTHENTICATION
========================================================= */

function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
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
        message: "User ID missing from token",
      });
    }

    req.user = {
      ...decoded,
      id: userId,
    };

    next();
  } catch (error) {
    console.error(
      "PAYMENT AUTH ERROR:",
      error
    );

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

/* =========================================================
   ADMIN CHECK
========================================================= */

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin access required",
    });
  }

  next();
}

/* =========================================================
   RESOLVE PLAN
========================================================= */

async function resolvePlan(planValue) {
  if (!planValue) {
    return {
      plan: null,
      error: "Plan is required",
    };
  }

  const config = PLAN_CONFIG[planValue];

  if (!config) {
    return {
      plan: null,
      error: "Invalid plan selected",
    };
  }

  /* Try slug */

  const {
    data: planBySlug,
    error: slugError,
  } = await supabase
    .from("plans")
    .select("*")
    .eq("slug", planValue)
    .maybeSingle();

  if (!slugError && planBySlug) {
    return {
      plan: planBySlug,
      error: null,
    };
  }

  /* Try name */

  const {
    data: planByName,
    error: nameError,
  } = await supabase
    .from("plans")
    .select("*")
    .eq("name", config.name)
    .maybeSingle();

  if (!nameError && planByName) {
    return {
      plan: planByName,
      error: null,
    };
  }

  console.error(
    "PLAN LOOKUP ERROR:",
    slugError || nameError
  );

  return {
    plan: null,
    error: "Plan was not found in the database.",
  };
}

/* =========================================================
   GET PLAN FROM PAYMENT
========================================================= */

async function getPlanFromPayment(payment) {
  let plan = null;

  /* Relationship */

  if (payment.plans) {
    plan = payment.plans;
  }

  /* Direct lookup */

  if (!plan) {
    const {
      data,
      error,
    } = await supabase
      .from("plans")
      .select("*")
      .eq("id", payment.plan_id)
      .maybeSingle();

    if (error) {
      return {
        plan: null,
        error: error.message,
      };
    }

    plan = data;
  }

  if (!plan) {
    return {
      plan: null,
      error: "Payment plan could not be found.",
    };
  }

  let slug = plan.slug;

  let config =
    slug && PLAN_CONFIG[slug]
      ? PLAN_CONFIG[slug]
      : null;

  /* Fallback by name */

  if (!config) {
    const name = String(
      plan.name || ""
    ).toLowerCase();

    if (name.includes("monthly")) {
      slug = "monthly";
      config = PLAN_CONFIG.monthly;
    } else if (
      name.includes("6") ||
      name.includes("six")
    ) {
      slug = "six-months";
      config = PLAN_CONFIG["six-months"];
    } else if (
      name.includes("year")
    ) {
      slug = "yearly";
      config = PLAN_CONFIG.yearly;
    }
  }

  if (!config) {
    return {
      plan: null,
      error: "Invalid payment plan.",
    };
  }

  return {
    plan,
    slug,
    config,
    error: null,
  };
}

/* =========================================================
   GENERATE CHATBOT INSTALLATION CODE
========================================================= */

function generateWidgetInstallationCode(
  businessId
) {
  const backendUrl =
    process.env.BACKEND_PUBLIC_URL ||
    "http://localhost:5000";

  return `<script>
window.NEURA_BOT_BUSINESS_ID = "${businessId}";
</script>
<script src="${backendUrl}/widget/neura-bot.js" defer></script>`;
}

/* =========================================================
   GENERATE INSTALLATION DETAILS
========================================================= */

function generateInstallationDetails(
  businessId
) {
 const backendUrl =
  process.env.BACKEND_PUBLIC_URL ||
  "https://neurabot-backend-ai-2335.vercel.app";

  return {
    title: "NeuraBot Website Installation",

    instructions: [
      "Copy the complete code provided below.",
      "Open your website code.",
      "Paste the code before the closing </body> tag.",
      "Save and publish your website.",
      "The NeuraBot button will appear automatically.",
    ],

    code: generateWidgetInstallationCode(
      businessId
    ),

    scriptUrl:
      `${backendUrl}/widget/neura-bot.js`,
  };
}

/* =========================================================
   CUSTOMER - SUBMIT PAYMENT
========================================================= */

router.post(
  "/submit",
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const {
        planId,
        transactionId,
        amount,
      } = req.body;

      /* PLAN */

      if (!planId) {
        return res.status(400).json({
          message: "Plan is required",
        });
      }

      const {
        plan,
        error: planError,
      } = await resolvePlan(planId);

      if (planError || !plan) {
        return res.status(400).json({
          message:
            planError ||
            "Selected plan could not be found",
        });
      }

      /* TRANSACTION */

      if (
        !transactionId ||
        !String(transactionId).trim()
      ) {
        return res.status(400).json({
          message:
            "Transaction ID is required",
        });
      }

      const cleanTransactionId =
        String(transactionId).trim();

      /* AMOUNT */

      if (
        amount === undefined ||
        amount === null ||
        amount === ""
      ) {
        return res.status(400).json({
          message:
            "Payment amount is required",
        });
      }

      const numericAmount = Number(amount);

      if (
        Number.isNaN(numericAmount) ||
        numericAmount <= 0
      ) {
        return res.status(400).json({
          message:
            "Invalid payment amount",
        });
      }

      /* BUSINESS */

      const {
        data: business,
        error: businessError,
      } = await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (businessError) {
        console.error(
          "PAYMENT BUSINESS ERROR:",
          businessError
        );

        return res.status(500).json({
          message: businessError.message,
        });
      }

      if (!business) {
        return res.status(404).json({
          message: "Business not found",
        });
      }

      /* DUPLICATE TRANSACTION */

      const {
        data: existingPayment,
        error: duplicateError,
      } = await supabase
        .from("payments")
        .select("id, status")
        .eq(
          "transaction_id",
          cleanTransactionId
        )
        .maybeSingle();

      if (duplicateError) {
        console.error(
          "DUPLICATE PAYMENT ERROR:",
          duplicateError
        );

        return res.status(500).json({
          message:
            duplicateError.message,
        });
      }

      if (existingPayment) {
        return res.status(409).json({
          message:
            "This transaction ID has already been submitted.",
        });
      }

      /* CREATE PAYMENT */

      const {
        data: payment,
        error: paymentError,
      } = await supabase
        .from("payments")
        .insert({
          user_id: userId,
          business_id: business.id,
          plan_id: plan.id,
          transaction_id:
            cleanTransactionId,
          amount: numericAmount,
          status: "pending",
        })
        .select()
        .single();

      if (paymentError) {
        console.error(
          "CREATE PAYMENT ERROR:",
          paymentError
        );

        return res.status(500).json({
          message:
            paymentError.message,
        });
      }

      return res.status(201).json({
        success: true,

        message:
          "Payment submitted successfully. Waiting for verification.",

        payment,

        plan: {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          amount: numericAmount,
        },

        subscription: {
          status: "pending",
          message:
            "Your subscription will become active after admin verification.",
        },
      });
    } catch (error) {
      console.error(
        "SUBMIT PAYMENT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not submit payment",
      });
    }
  }
);

/* =========================================================
   CUSTOMER - MY PAYMENT + SUBSCRIPTION STATUS
========================================================= */

router.get(
  "/my-status",
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user.id;

      /* -----------------------------------------
         PAYMENTS
      ----------------------------------------- */

      const {
        data: payments,
        error: paymentError,
      } = await supabase
        .from("payments")
        .select(`
          *,
          plans (
            id,
            name,
            slug
          )
        `)
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        });

      if (paymentError) {
        console.error(
          "MY PAYMENT STATUS ERROR:",
          paymentError
        );

        return res.status(500).json({
          message: paymentError.message,
        });
      }

      /* -----------------------------------------
         BUSINESS
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
          "MY BUSINESS ERROR:",
          businessError
        );
      }

      /* -----------------------------------------
         ACTIVE SUBSCRIPTION
      ----------------------------------------- */

      let subscription = null;

      if (business) {
        const {
          data,
          error,
        } = await supabase
          .from("subscriptions")
          .select(`
            *,
            plans (
              id,
              name,
              slug
            )
          `)
          .eq("user_id", userId)
          .eq("business_id", business.id)
          .eq("status", "active")
          .order("expires_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error(
            "MY SUBSCRIPTION ERROR:",
            error
          );
        } else {
          subscription = data;
        }
      }

      /* -----------------------------------------
         CHECK EXPIRATION
      ----------------------------------------- */

      if (
        subscription &&
        subscription.expires_at
      ) {
        const expires =
          new Date(
            subscription.expires_at
          );

        const now = new Date();

        if (expires <= now) {
          await supabase
            .from("subscriptions")
            .update({
              status: "expired",
            })
            .eq(
              "id",
              subscription.id
            );

          subscription = {
            ...subscription,
            status: "expired",
          };
        }
      }

      /* -----------------------------------------
         INSTALLATION
      ----------------------------------------- */

      let installation = null;

      if (
        subscription &&
        subscription.status === "active" &&
        business
      ) {
        installation =
          generateInstallationDetails(
            business.id
          );
      }

      return res.json({
        success: true,

        payments:
          payments || [],

        subscription,

        business,

        installation,
      });
    } catch (error) {
      console.error(
        "MY STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not load account status",
      });
    }
  }
);

/* =========================================================
   ADMIN - ALL PAYMENTS
========================================================= */

router.get(
  "/all",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        data: payments,
        error: paymentsError,
      } = await supabase
        .from("payments")
        .select(`
          *,
          plans (
            id,
            name,
            slug
          )
        `)
        .order("created_at", {
          ascending: false,
        });

      if (paymentsError) {
        console.error(
          "GET ALL PAYMENTS ERROR:",
          paymentsError
        );

        return res.status(500).json({
          message:
            paymentsError.message,
        });
      }

      if (
        !payments ||
        payments.length === 0
      ) {
        return res.json({
          success: true,
          payments: [],
        });
      }

      /* USERS */

      const userIds = [
        ...new Set(
          payments
            .map(
              (payment) =>
                payment.user_id
            )
            .filter(Boolean)
        ),
      ];

      let users = [];

      if (userIds.length > 0) {
        const {
          data,
          error,
        } = await supabase
          .from("users")
          .select(
            "id, full_name, email"
          )
          .in("id", userIds);

        if (!error) {
          users = data || [];
        }
      }

      /* BUSINESSES */

      const businessIds = [
        ...new Set(
          payments
            .map(
              (payment) =>
                payment.business_id
            )
            .filter(Boolean)
        ),
      ];

      let businesses = [];

      if (businessIds.length > 0) {
        const {
          data,
          error,
        } = await supabase
          .from("businesses")
          .select(
            "id, name, category"
          )
          .in(
            "id",
            businessIds
          );

        if (!error) {
          businesses =
            data || [];
        }
      }

      /* FORMAT */

      const formattedPayments =
        payments.map(
          (payment) => {
            const user =
              users.find(
                (item) =>
                  item.id ===
                  payment.user_id
              );

            const business =
              businesses.find(
                (item) =>
                  item.id ===
                  payment.business_id
              );

            return {
              ...payment,

              customer: user
                ? {
                    id: user.id,
                    name:
                      user.full_name,
                    email:
                      user.email,
                  }
                : null,

              business: business
                ? {
                    id: business.id,
                    name:
                      business.name,
                    category:
                      business.category,
                  }
                : null,
            };
          }
        );

      return res.json({
        success: true,
        payments:
          formattedPayments,
      });
    } catch (error) {
      console.error(
        "ADMIN PAYMENT LIST ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not load payments",
      });
    }
  }
);

/* =========================================================
   ADMIN - VERIFY PAYMENT
========================================================= */

router.post(
  "/verify",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        paymentId,
        approved,
      } = req.body;

      /* VALIDATE */

      if (!paymentId) {
        return res.status(400).json({
          message:
            "Payment ID is required",
        });
      }

      /* GET PAYMENT */

      const {
        data: payment,
        error: paymentError,
      } = await supabase
        .from("payments")
        .select(`
          *,
          plans (
            id,
            name,
            slug
          )
        `)
        .eq("id", paymentId)
        .maybeSingle();

      if (paymentError) {
        console.error(
          "FIND PAYMENT ERROR:",
          paymentError
        );

        return res.status(500).json({
          message:
            paymentError.message,
        });
      }

      if (!payment) {
        return res.status(404).json({
          message:
            "Payment not found",
        });
      }

      /* ALREADY PROCESSED */

      if (
        payment.status === "approved"
      ) {
        return res.status(409).json({
          message:
            "This payment has already been approved.",
        });
      }

      if (
        payment.status === "rejected"
      ) {
        return res.status(409).json({
          message:
            "This payment has already been rejected.",
        });
      }

      /* =====================================================
         REJECT
      ===================================================== */

      if (approved !== true) {
        const {
          data: rejectedPayment,
          error: rejectError,
        } = await supabase
          .from("payments")
          .update({
            status: "rejected",
            verified_at:
              new Date().toISOString(),
          })
          .eq("id", paymentId)
          .select()
          .single();

        if (rejectError) {
          console.error(
            "REJECT PAYMENT ERROR:",
            rejectError
          );

          return res.status(500).json({
            message:
              rejectError.message,
          });
        }

        return res.json({
          success: true,
          status: "rejected",
          payment:
            rejectedPayment,
          message:
            "Payment rejected",
        });
      }

      /* =====================================================
         GET PLAN
      ===================================================== */

      const {
        plan,
        config,
        error: planError,
      } = await getPlanFromPayment(
        payment
      );

      if (planError || !plan) {
        return res.status(400).json({
          message:
            planError ||
            "Invalid payment plan.",
        });
      }

      /* =====================================================
         CALCULATE SUBSCRIPTION
      ===================================================== */

      const now = new Date();

      const expiresAt =
        new Date(now);

      expiresAt.setMonth(
        expiresAt.getMonth() +
          config.months
      );

      /* =====================================================
         APPROVE PAYMENT
      ===================================================== */

      const {
        data: updatedPayment,
        error: updateError,
      } = await supabase
        .from("payments")
        .update({
          status: "approved",
          paid_at:
            now.toISOString(),
          verified_at:
            now.toISOString(),
        })
        .eq("id", paymentId)
        .select()
        .single();

      if (updateError) {
        console.error(
          "APPROVE PAYMENT ERROR:",
          updateError
        );

        return res.status(500).json({
          message:
            updateError.message,
        });
      }

      /* =====================================================
         FIND ACTIVE SUBSCRIPTION
      ===================================================== */

      const {
        data: existingSubscription,
        error:
          existingSubscriptionError,
      } = await supabase
        .from("subscriptions")
        .select("*")
        .eq(
          "user_id",
          payment.user_id
        )
        .eq(
          "business_id",
          payment.business_id
        )
        .eq(
          "status",
          "active"
        )
        .maybeSingle();

      if (
        existingSubscriptionError
      ) {
        console.error(
          "CHECK SUBSCRIPTION ERROR:",
          existingSubscriptionError
        );

        return res.status(500).json({
          message:
            existingSubscriptionError.message,
        });
      }

      let subscription;

      /* =====================================================
         RENEW EXISTING SUBSCRIPTION
      ===================================================== */

      if (existingSubscription) {
        const {
          data: renewedSubscription,
          error: renewError,
        } = await supabase
          .from("subscriptions")
          .update({
            plan_id:
              payment.plan_id,

            plan_name:
              plan.name,

            amount:
              Number(payment.amount),

            status:
              "active",

            started_at:
              now.toISOString(),

            expires_at:
              expiresAt.toISOString(),
          })
          .eq(
            "id",
            existingSubscription.id
          )
          .select()
          .single();

        if (renewError) {
          console.error(
            "RENEW SUBSCRIPTION ERROR:",
            renewError
          );

          return res.status(500).json({
            message:
              renewError.message,
          });
        }

        subscription =
          renewedSubscription;
      }

      /* =====================================================
         CREATE NEW SUBSCRIPTION
      ===================================================== */

      else {
        const {
          data: newSubscription,
          error: subscriptionError,
        } = await supabase
          .from("subscriptions")
          .insert({
            user_id:
              payment.user_id,

            business_id:
              payment.business_id,

            plan_id:
              payment.plan_id,

            plan_name:
              plan.name,

            amount:
              Number(payment.amount),

            status:
              "active",

            started_at:
              now.toISOString(),

            expires_at:
              expiresAt.toISOString(),
          })
          .select()
          .single();

        if (subscriptionError) {
          console.error(
            "CREATE SUBSCRIPTION ERROR:",
            subscriptionError
          );

          return res.status(500).json({
            message:
              subscriptionError.message,
          });
        }

        subscription =
          newSubscription;
      }

      /* =====================================================
         GENERATE INSTALLATION CODE
      ===================================================== */

      const installation =
        generateInstallationDetails(
          payment.business_id
        );

      /* =====================================================
         SUCCESS
      ===================================================== */

      return res.json({
        success: true,

        status: "approved",

        payment:
          updatedPayment,

        subscription,

        installation,

        message:
          "Payment approved, subscription activated and chatbot installation code generated.",
      });
    } catch (error) {
      console.error(
        "VERIFY PAYMENT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not verify payment",
      });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

module.exports = router;