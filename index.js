require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const businessRoutes = require("./routes/business");
const aiRoutes = require("./routes/ai");
const paymentRoutes = require("./routes/payment");
const adminRoutes = require("./routes/admin");
const widgetRoutes = require("./routes/widget");
const widgetInstallRoutes =
  require("./routes/widgetInstall");

const app = express();

/* =========================================
   CORS
========================================= */

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

/* =========================================
   BODY PARSERS
========================================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================
   PUBLIC WIDGET FILES
========================================= */

app.use(
  "/widget",
  express.static(
    path.join(__dirname, "widget")
  )
);

/* =========================================
   ROOT
========================================= */

app.get("/", (req, res) => {
  res.json({
    message: "AI Chatbot Backend Running",
    environment:
      process.env.NODE_ENV || "development",
  });
});

/* =========================================
   API ROUTES
========================================= */

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/business",
  businessRoutes
);

app.use(
  "/api/ai",
  aiRoutes
);

app.use(
  "/api/payment",
  paymentRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

app.use(
  "/api/widget",
  widgetRoutes
);
app.use(
  "/api/widget-install",
  widgetInstallRoutes
);

/* =========================================
   404
========================================= */

app.use((req, res) => {
  res.status(404).json({
    message:
      `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/* =========================================
   GLOBAL ERROR
========================================= */

app.use(
  (err, req, res, next) => {
    console.error(
      "GLOBAL SERVER ERROR:",
      err
    );

    res.status(500).json({
      message:
        "Internal server error",
    });
  }
);

/* =========================================
   START SERVER
========================================= */

const PORT =
  process.env.PORT || 5000;

app.listen(
  PORT,
  () => {
    console.log(
      "================================="
    );

    console.log(
      "AI Chatbot Backend Started"
    );

    console.log(
      `Server: http://localhost:${PORT}`
    );

    console.log(
      `Environment: ${
        process.env.NODE_ENV ||
        "development"
      }`
    );

    console.log(
      "Auth API: /api/auth"
    );

    console.log(
      "Business API: /api/business"
    );

    console.log(
      "AI API: /api/ai"
    );

    console.log(
      "Payment API: /api/payment"
    );

    console.log(
      "Admin API: /api/admin"
    );

    console.log(
      "Widget API: /api/widget"
    );

    console.log(
      "Widget Files: /widget"
    );

    console.log(
      "================================="
    );
  }
);