const express = require("express");
const cors = require("cors");

const buildingRoutes = require("./routes/buildingRoutes");
const moduleRoutes = require("./routes/moduleRoutes");
const telemetryRoutes = require("./routes/telemetryRoutes");
const alertRoutes = require("./routes/alertRoutes");
const userRoutes = require("./routes/userRoutes");
const { setUserContext, requireRole } = require("./middleware/authMiddleware");
const { Building } = require("./models");

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

// Veřejný endpoint pro registraci — list budov bez auth (pro dropdown ve formuláři)
app.get("/building/public-list", async (req, res) => {
  try {
    const buildings = await Building.find()
      .select("_id name address floors")
      .sort({ name: 1 })
      .lean();
    res.json({ itemList: buildings, total: buildings.length });
  } catch (err) {
    res.status(500).json({ code: "internalError", message: err.message });
  }
});

// User routes (PUBLIC + ADMIN)
app.use("/user", userRoutes);

// Chráněné routes s RBAC (role: USER, RESCUER, ADMIN, SYSTEM)
app.use("/building", requireRole(["ADMIN", "USER", "RESCUER", "SYSTEM"]), buildingRoutes);
app.use("/module", requireRole(["ADMIN", "SYSTEM"]), moduleRoutes);
app.use("/telemetry", telemetryRoutes); // Gateway service - bez auth (volá hardware)
app.use("/alert", requireRole(["ADMIN", "USER", "RESCUER", "SYSTEM"]), alertRoutes);

app.use((req, res) => {
  res.status(404).json({
    code: "notFound",
    message: "Endpoint does not exist."
  });
});

module.exports = app;