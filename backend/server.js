const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
require("dotenv").config();

const connectDB = require("./src/config/db");
const errorHandler = require("./src/middleware/errorHandler");
const { startMonitoringJob } = require("./src/jobs/monitoringJob");
const blockchainService = require("./src/services/blockchainService");
const mlService = require("./src/services/mlService");

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes = require("./src/routes/authRoutes");
const landRoutes = require("./src/routes/landRoutes");
const verificationRoutes = require("./src/routes/verificationRoutes");
const transactionRoutes = require("./src/routes/transactionRoutes");

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" })); // 10mb for base64 satellite images
app.use(express.urlencoded({ extended: true }));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/lands", landRoutes);
app.use("/api/verify", verificationRoutes);
app.use("/api/transactions", transactionRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", async (req, res) => {
  const mlHealthy = await mlService.checkHealth();
  res.json({
    status: "✅ Backend running",
    timestamp: new Date(),
    services: {
      mongodb: "✅ connected",
      ml: mlHealthy ? "✅ running" : "⚠️  not reachable",
      blockchain: blockchainService.getAddresses()?.LandRegistry
        ? "✅ configured"
        : "⚠️  not configured",
    },
  });
});

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(process.env.PORT || 5000, () => {
    const port = process.env.PORT || 5000;

    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║      LandChain Backend Server 🚀         ║");
    console.log("╠══════════════════════════════════════════╣");
    console.log(`║  Port:     ${port}                          ║`);
    console.log(
      `║  Frontend: ${process.env.FRONTEND_URL || "http://localhost:5173"}  ║`,
    );
    console.log("╚══════════════════════════════════════════╝\n");

    // Initialize services
    blockchainService.init();
    startMonitoringJob();

    // Check ML service is reachable
    setTimeout(() => {
      mlService.checkHealth().then((healthy) => {
        if (!healthy) {
          console.warn(
            "⚠️ ML service not reachable at",
            process.env.ML_SERVICE_URL,
          );
        }
      });
    }, 5000);
  });
});
