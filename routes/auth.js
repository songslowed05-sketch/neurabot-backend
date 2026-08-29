const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");

const router = express.Router();

/* =========================================
   SIGNUP
========================================= */

router.post("/signup", async (req, res) => {
  try {
    console.log("SIGNUP REQUEST RECEIVED");

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const fullName = name.trim();

    const {
      data: existingUser,
      error: existingError,
    } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingError) {
      console.error("SIGNUP CHECK ERROR:", existingError);

      return res.status(500).json({
        message: existingError.message || "Database error",
      });
    }

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const {
      data: user,
      error,
    } = await supabase
      .from("users")
      .insert([
        {
          full_name: fullName,
          email: normalizedEmail,
          password_hash: passwordHash,
          role: "owner",
        },
      ])
      .select("id, full_name, email, role, business_id")
      .single();

    if (error) {
      console.error("SIGNUP DATABASE ERROR:", error);

      return res.status(500).json({
        message: error.message || "Could not create account",
      });
    }

    console.log("SIGNUP SUCCESS:", user.id);

    return res.status(201).json({
      message: "Account created successfully",
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        businessId: user.business_id,
      },
    });
  } catch (error) {
    console.error("SIGNUP SERVER ERROR:", error);

    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

/* =========================================
   LOGIN
========================================= */

router.post("/login", async (req, res) => {
  try {
    console.log("LOGIN REQUEST RECEIVED");

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    console.log("LOGIN EMAIL:", normalizedEmail);

    const {
      data: user,
      error,
    } = await supabase
      .from("users")
      .select(
        "id, full_name, email, password_hash, role, business_id"
      )
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error("SUPABASE LOGIN ERROR:", error);

      return res.status(500).json({
        message: error.message || "Database error",
      });
    }

    console.log("USER FOUND:", !!user);

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!user.password_hash) {
      console.error("PASSWORD HASH IS EMPTY");

      return res.status(500).json({
        message: "User password is not configured",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    console.log("PASSWORD MATCH:", passwordMatch);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    /* =========================================
       JWT CHECK
    ========================================= */

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET IS MISSING");

      return res.status(500).json({
        message: "JWT configuration is missing",
      });
    }

    /* =========================================
       CREATE JWT
       IMPORTANT: id IS INCLUDED
    ========================================= */

    const token = jwt.sign(
      {
        id: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        businessId: user.business_id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    console.log("LOGIN SUCCESS");
    console.log("JWT USER ID:", user.id);

    return res.json({
      message: "Login successful",

      token,

      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        businessId: user.business_id,
      },
    });
  } catch (error) {
    console.error("LOGIN SERVER ERROR:", error);

    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

/* =========================================
   EXPORT
========================================= */

module.exports = router;