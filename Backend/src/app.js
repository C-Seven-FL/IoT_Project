const express = require("express");
const cors = require("cors");

const buildingRoutes = require("./routes/buildingRoutes");
const moduleRoutes = require("./routes/moduleRoutes");
const telemetryRoutes = require("./routes/telemetryRoutes");
const alertRoutes = require("./routes/alertRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Smart Guard IoT backend is running"
  });
});

app.use("/building", buildingRoutes);
app.use("/module", moduleRoutes);
app.use("/telemetry", telemetryRoutes);
app.use("/alert", alertRoutes);

app.use((req, res) => {
  res.status(404).json({
    code: "notFound",
    message: "Endpoint does not exist."
  });
});

module.exports = app;