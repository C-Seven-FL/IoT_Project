const express = require("express");
const { Building, Module, SensorReading, Alert } = require("../models");

const router = express.Router();

const TEMPERATURE_WARNING = 45;
const TEMPERATURE_DANGER = 60;
const ACCELERATION_DANGER = 2.2;

function calculateAccelerationMagnitude(accelerometer) {
  if (!accelerometer) return 0;

  const x = Number(accelerometer.x || 0);
  const y = Number(accelerometer.y || 0);
  const z = Number(accelerometer.z || 0);

  return Math.sqrt(x * x + y * y + z * z);
}

async function createAlertIfNotExists(alertData) {
  const existingAlert = await Alert.findOne({
    moduleId: alertData.moduleId,
    type: alertData.type,
    status: "ACTIVE"
  });

  if (existingAlert) {
    return null;
  }

  return Alert.create(alertData);
}

router.get("/test", (req, res) => {
  res.json({
    message: "Telemetry route works"
  });
});

router.post("/create", async (req, res) => {
  try {
    const {
      gatewayId,
      moduleId,
      temperature,
      accelerometer,
      buttonPressed,
      timestamp
    } = req.body;

    if (!gatewayId || !moduleId) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "gatewayId and moduleId are required."
      });
    }

    const module = await Module.findOne({ moduleId });

    if (!module) {
      return res.status(404).json({
        code: "moduleNotFound",
        message: "Module was not found. Create module first by /module/create."
      });
    }

    if (module.gatewayId !== gatewayId) {
      return res.status(400).json({
        code: "gatewayMismatch",
        message: "Gateway id does not match module configuration."
      });
    }

    const reading = await SensorReading.create({
      gatewayId,
      moduleId,
      building: module.building,
      floor: module.floor,
      temperature,
      accelerometer,
      buttonPressed: Boolean(buttonPressed),
      measuredAt: timestamp ? new Date(timestamp) : new Date()
    });

    const createdAlerts = [];

    if (Boolean(buttonPressed)) {
      const alert = await createAlertIfNotExists({
        building: module.building,
        gatewayId,
        moduleId,
        floor: module.floor,
        type: "SOS",
        severity: "CRITICAL",
        message: `SOS button was pressed on floor ${module.floor}.`
      });

      if (alert) createdAlerts.push(alert);
    }

    if (typeof temperature === "number" && temperature >= TEMPERATURE_DANGER) {
      const alert = await createAlertIfNotExists({
        building: module.building,
        gatewayId,
        moduleId,
        floor: module.floor,
        type: "FIRE",
        severity: "HIGH",
        message: `High temperature detected on floor ${module.floor}. Temperature: ${temperature} °C.`
      });

      if (alert) createdAlerts.push(alert);
    }

    const accelerationMagnitude = calculateAccelerationMagnitude(accelerometer);

    if (accelerationMagnitude >= ACCELERATION_DANGER) {
      const alert = await createAlertIfNotExists({
        building: module.building,
        gatewayId,
        moduleId,
        floor: module.floor,
        type: "TAMPER",
        severity: "HIGH",
        message: `Suspicious movement detected on floor ${module.floor}.`
      });

      if (alert) createdAlerts.push(alert);
    }

    const hasActiveAlert = await Alert.exists({
  moduleId,
  status: "ACTIVE"
});

let moduleStatus = "ONLINE";

if (
  hasActiveAlert ||
  Boolean(buttonPressed) ||
  (typeof temperature === "number" && temperature >= TEMPERATURE_DANGER) ||
  accelerationMagnitude >= ACCELERATION_DANGER
) {
  moduleStatus = "DANGER";
} else if (typeof temperature === "number" && temperature >= TEMPERATURE_WARNING) {
  moduleStatus = "WARNING";
}

    module.status = moduleStatus;
    module.lastSeen = new Date();
    module.lastTemperature = temperature ?? null;
    module.lastAccelerometer = {
      x: accelerometer?.x ?? null,
      y: accelerometer?.y ?? null,
      z: accelerometer?.z ?? null
    };

    await module.save();

    if (createdAlerts.length > 0) {
      await Building.findByIdAndUpdate(module.building, {
        status: "DANGER"
      });
    }

    res.status(201).json({
      message: "Telemetry was saved.",
      readingId: reading._id,
      moduleStatus,
      createdAlerts
    });
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

router.get("/list", async (req, res) => {
  try {
    const { moduleId } = req.query;

    const filter = {};

    if (moduleId) {
      filter.moduleId = moduleId;
    }

    const readings = await SensorReading.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      itemList: readings,
      total: readings.length
    });
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

module.exports = router;