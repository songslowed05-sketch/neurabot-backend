const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");

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

    console.log("JWT DECODED:", decoded);

    /*
      Login ke waqt hum token mein userId save kar rahe hain.
      Isliye yahan userId ko priority denge.
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
    console.error("AUTH ERROR:", error);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

/* =========================================================
   GET BUSINESS
========================================================= */

router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("GET BUSINESS USER ID:", userId);

    /*
      Sirf current logged-in user ka business.
    */

    const {
      data: business,
      error: businessError,
    } = await supabase
      .from("businesses")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (businessError) {
      console.error(
        "GET BUSINESS ERROR:",
        businessError
      );

      return res.status(500).json({
        message: businessError.message,
      });
    }

    /*
      Agar business abhi create nahi hua.
    */

    if (!business) {
      return res.json({
        business: null,
        items: [],
      });
    }

    /*
      Sirf isi business ke products/services.
    */

    const {
      data: items,
      error: itemsError,
    } = await supabase
      .from("business_items")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", {
        ascending: true,
      });

    if (itemsError) {
      console.error(
        "GET ITEMS ERROR:",
        itemsError
      );

      return res.status(500).json({
        message: itemsError.message,
      });
    }

    return res.json({
      business,
      items: items || [],
    });
  } catch (error) {
    console.error(
      "GET BUSINESS SERVER ERROR:",
      error
    );

    return res.status(500).json({
      message: "Failed to load business",
    });
  }
});

/* =========================================================
   SAVE BUSINESS
========================================================= */

router.post("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(
      "SAVE BUSINESS USER ID:",
      userId
    );

    console.log(
      "SAVE BUSINESS BODY:",
      JSON.stringify(req.body, null, 2)
    );

    /*
      IMPORTANT:

      Dashboard se payload is structure mein aa raha hai:

      {
        business: {
          category,
          name,
          location,
          ...
        },
        items: [...]
      }

      Isliye business data req.body.business se lena hai.
    */

    const businessData = req.body.business || {};

    const {
      category,
      name,
      location,
      phone,
      email,
      website,
      openingTime,
      closingTime,
      mainInfo,
      customInfo,
      plan,
    } = businessData;

    /*
      Products / services
    */

    const items = Array.isArray(req.body.items)
      ? req.body.items
      : [];

    /* =====================================================
       CHECK EXISTING BUSINESS
    ===================================================== */

    const {
      data: existingBusiness,
      error: existingError,
    } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      console.error(
        "CHECK BUSINESS ERROR:",
        existingError
      );

      return res.status(500).json({
        message: existingError.message,
      });
    }

    let business;

    /* =====================================================
       UPDATE EXISTING BUSINESS
    ===================================================== */

    if (existingBusiness) {
      console.log(
        "UPDATING BUSINESS:",
        existingBusiness.id
      );

      const {
        data,
        error,
      } = await supabase
        .from("businesses")
        .update({
          category: category || null,
          name: name || null,
          location: location || null,
          phone: phone || null,
          email: email || null,
          website: website || null,

          opening_time:
            openingTime || null,

          closing_time:
            closingTime || null,

          main_info:
            mainInfo || null,

          custom_info:
            customInfo || null,

          /*
            Agar businesses table mein plan column hai
            to ye save hoga.
          */
          ...(plan
            ? {
                plan: plan,
              }
            : {}),

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", existingBusiness.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        console.error(
          "UPDATE BUSINESS ERROR:",
          error
        );

        return res.status(500).json({
          message: error.message,
        });
      }

      business = data;
    }

    /* =====================================================
       CREATE NEW BUSINESS
    ===================================================== */

    else {
      console.log(
        "CREATING NEW BUSINESS FOR USER:",
        userId
      );

      const insertData = {
        user_id: userId,

        category: category || null,
        name: name || null,
        location: location || null,
        phone: phone || null,
        email: email || null,
        website: website || null,

        opening_time:
          openingTime || null,

        closing_time:
          closingTime || null,

        main_info:
          mainInfo || null,

        custom_info:
          customInfo || null,
      };

      /*
        Plan agar selected hai to insert mein add hoga.
      */

      if (plan) {
        insertData.plan = plan;
      }

      const {
        data,
        error,
      } = await supabase
        .from("businesses")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error(
          "CREATE BUSINESS ERROR:",
          error
        );

        return res.status(500).json({
          message: error.message,
        });
      }

      business = data;
    }

    /* =====================================================
       DELETE OLD ITEMS
    ===================================================== */

    const {
      error: deleteError,
    } = await supabase
      .from("business_items")
      .delete()
      .eq("business_id", business.id);

    if (deleteError) {
      console.error(
        "DELETE OLD ITEMS ERROR:",
        deleteError
      );

      return res.status(500).json({
        message: deleteError.message,
      });
    }

    /* =====================================================
       PREPARE NEW ITEMS
    ===================================================== */

    const validItems = items
      .filter(
        (item) =>
          item &&
          item.name &&
          String(item.name).trim()
      )
      .map((item) => ({
        /*
          Business ID backend khud set karega.
          Frontend business_id nahi bhejega.
        */

        business_id: business.id,

        name: String(item.name).trim(),

        price:
          item.price &&
          String(item.price).trim()
            ? String(item.price).trim()
            : null,

        description:
          item.description &&
          String(item.description).trim()
            ? String(item.description).trim()
            : null,
      }));

    console.log(
      "VALID BUSINESS ITEMS:",
      validItems
    );

    /* =====================================================
       SAVE NEW ITEMS
    ===================================================== */

    if (validItems.length > 0) {
      const {
        error: itemsError,
      } = await supabase
        .from("business_items")
        .insert(validItems);

      if (itemsError) {
        console.error(
          "SAVE ITEMS ERROR:",
          itemsError
        );

        return res.status(500).json({
          message: itemsError.message,
        });
      }
    }

    /* =====================================================
       SUCCESS
    ===================================================== */

    console.log(
      "BUSINESS SAVED SUCCESSFULLY:",
      business.id
    );

    return res.json({
      message:
        "Business information saved successfully",

      business,

      items: validItems,
    });
  } catch (error) {
    console.error(
      "SAVE BUSINESS SERVER ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Failed to save business",
    });
  }
});

module.exports = router;