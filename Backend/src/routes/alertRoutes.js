const express = require("express");
const { Alert, Module, Building } = require("../models");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({
    message: "Alert route works"
  });
});

router.get("/list", async (req, res) => {
  try {
    const { buildingId, status } = req.query;

    const filter = {};

    if (buildingId) {
      filter.building = buildingId;
    }

    if (status) {
      filter.status = status;
    }

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      itemList: alerts,
      total: alerts.length
    });
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

router.post("/resolve", async (req, res) => {
  try {
    const { alertId } = req.body;

    if (!alertId) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "alertId is required."
      });
    }

    const alert = await Alert.findById(alertId);

    if (!alert) {
      return res.status(404).json({
        code: "alertNotFound",
        message: "Alert was not found."
      });
    }

    alert.status = "RESOLVED";
    alert.resolvedAt = new Date();

    await alert.save();

    const activeModuleAlerts = await Alert.find({
      moduleId: alert.moduleId,
      status: "ACTIVE"
    });

    const module = await Module.findOne({
      moduleId: alert.moduleId
    });

    if (module && activeModuleAlerts.length === 0) {
      if (module.lastTemperature !== null && module.lastTemperature >= 45) {
        module.status = "WARNING";
      } else {
        module.status = "ONLINE";
      }

      await module.save();
    }

    const activeBuildingAlerts = await Alert.find({
      building: alert.building,
      status: "ACTIVE"
    });

    if (activeBuildingAlerts.length > 0) {
      await Building.findByIdAndUpdate(alert.building, {
        status: "DANGER"
      });
    } else {
      const warningModules = await Module.find({
        building: alert.building,
        status: "WARNING"
      });

      await Building.findByIdAndUpdate(alert.building, {
        status: warningModules.length > 0 ? "WARNING" : "OK"
      });
    }

    res.json({
      message: "Alert was resolved.",
      alert
    });
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

module.exports = router;