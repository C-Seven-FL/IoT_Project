const express = require("express");
const cors = require("cors");

const buildingRoutes = require("./routes/buildingRoutes");
const moduleRoutes = require("./routes/moduleRoutes");
const telemetryRoutes = require("./routes/telemetryRoutes");
const alertRoutes = require("./routes/alertRoutes");
const userRoutes = require("./routes/userRoutes");
const { setUserContext, requireRole } = require("./middleware/authMiddleware");

const app = express();

app.use(cors());
app.use(express.json());

// Auth middleware pro všechny requesty
app.use(setUserContext);

app.get("/", (req, res) => {
  res.json({
    message: "Smart Guard IoT backend is running"
  });
});

// User routes (PUBLIC + ADMIN)
app.use("/user", userRoutes);

// Chráněné routes s RBAC
app.use("/building", requireRole(["ADMIN", "MANAGER", "USER", "TECHNICIAN"]), buildingRoutes);
app.use("/module", requireRole(["ADMIN", "MANAGER", "TECHNICIAN"]), moduleRoutes);
app.use("/telemetry", telemetryRoutes); // Gateway service - bez auth
app.use("/alert", requireRole(["ADMIN", "MANAGER", "USER", "TECHNICIAN"]), alertRoutes);

app.use((req, res) => {
  res.status(404).json({
    code: "notFound",
    message: "Endpoint does not exist."
  });
});

module.exports = app;