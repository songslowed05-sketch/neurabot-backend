const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { adminAuthenticate } = require("../middleware/adminAuth");

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/* =========================
   ADMIN PROFILE
========================= */

router.get("/me", adminAuthenticate, async (req, res) => {
  res.json({
    success: true,
    admin: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      fullName: req.user.fullName,
    },
  });
});

/* =========================
   PENDING PAYMENTS
========================= */

router.get(
  "/payments",
  adminAuthenticate,
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          user_id,
          business_id,
          plan_id,
          transaction_id,
          amount,
          status,
          created_at,
          paid_at,
          verified_at
        `)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error("ADMIN PAYMENTS ERROR:", error);

        return res.status(500).json({
          message: error.message,
        });
      }

      res.json({
        success: true,
        payments: data || [],
      });
    } catch (error) {
      console.error("ADMIN PAYMENTS SERVER ERROR:", error);

      res.status(500).json({
        success: false,
        message: "Could not load payments",
      });
    }
  }
);

/* =========================
   PAYMENT VERIFICATION
========================= */

router.post(
  "/payments/verify",
  adminAuthenticate,
  async (req, res) => {
    try {
      const { paymentId, approved } = req.body;

      if (!paymentId) {
        return res.status(400).json({
          message: "Payment ID is required",
        });
      }

      if (typeof approved !== "boolean") {
        return res.status(400).json({
          message: "Approved must be true or false",
        });
      }

      const { data: payment, error } = await supabase
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .maybeSingle();

      if (error) {
        return res.status(500).json({
          message: error.message,
        });
      }

      if (!payment) {
        return res.status(404).json({
          message: "Payment not found",
        });
      }

      if (payment.status !== "pending") {
        return res.status(409).json({
          message: `Payment is already ${payment.status}`,
        });
      }

      /* =========================
         REJECT
      ========================= */

      if (!approved) {
        const { data, error: rejectError } =
          await supabase
            .from("payments")
            .update({
              status: "rejected",
              verified_at: new Date().toISOString(),
            })
            .eq("id", paymentId)
            .eq("status", "pending")
            .select()
            .single();

        if (rejectError) {
          return res.status(500).json({
            message: rejectError.message,
          });
        }

        return res.json({
          success: true,
          status: "rejected",
          payment: data,
        });
      }

      /* =========================
         CALCULATE EXPIRY
      ========================= */

      const now = new Date();
      const expiresAt = new Date(now);

      if (payment.plan_id === "monthly") {
        expiresAt.setMonth(
          expiresAt.getMonth() + 1
        );
      } else if (payment.plan_id === "six-months") {
        expiresAt.setMonth(
          expiresAt.getMonth() + 6
        );
      } else if (payment.plan_id === "yearly") {
        expiresAt.setFullYear(
          expiresAt.getFullYear() + 1
        );
      } else {
        return res.status(400).json({
          message: "Invalid plan",
        });
      }

      /* =========================
         MARK PAID
      ========================= */

      const { data: paidPayment, error: paidError } =
        await supabase
          .from("payments")
          .update({
            status: "paid",
            paid_at: now.toISOString(),
            verified_at: now.toISOString(),
          })
          .eq("id", paymentId)
          .eq("status", "pending")
          .select()
          .single();

      if (paidError) {
        return res.status(500).json({
          message: paidError.message,
        });
      }

      /* =========================
         CREATE SUBSCRIPTION
      ========================= */

      const {
        data: subscription,
        error: subscriptionError,
      } = await supabase
        .from("subscriptions")
        .insert({
          user_id: payment.user_id,
          business_id: payment.business_id,
          plan_id: payment.plan_id,
          payment_id: payment.id,
          status: "active",
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (subscriptionError) {
        await supabase
          .from("payments")
          .update({
            status: "pending",
            paid_at: null,
            verified_at: null,
          })
          .eq("id", paymentId);

        return res.status(500).json({
          message:
            "Subscription activation failed",
        });
      }

      return res.json({
        success: true,
        status: "paid",
        payment: paidPayment,
        subscription,
        message:
          "Payment approved and subscription activated",
      });
    } catch (error) {
      console.error("ADMIN VERIFY ERROR:", error);

      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not verify payment",
      });
    }
  }
);

module.exports = router;