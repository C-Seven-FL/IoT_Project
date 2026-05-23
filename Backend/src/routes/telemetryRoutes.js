const express = require("express");
const { SensorReading, Module } = require("../models");
const AlertService = require("../services/alertService");

const router = express.Router();

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
      accelerometerAlarm,
      buttonPressed,
      measuredAt
    } = req.body;

    // Validace
    if (!gatewayId || !moduleId) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "gatewayId and moduleId are required."
      });
    }

    // Najít modul podle moduleId
    const module = await Module.findOne({ moduleId });

    if (!module) {
      return res.status(404).json({
        code: "moduleNotFound",
        message: "Module not found."
      });
    }

    // Modul musí mít přiřazenou budovu a patro.
    // Tyto hodnoty se už neposílají z requestu, ale berou se z DB.
    if (!module.building || module.floor === undefined) {
      return res.status(409).json({
        code: "moduleLocationMissing",
        message: "Module does not have assigned building or floor."
      });
    }

    const measuredAtValue = measuredAt || new Date();

    // Aktualizovat poslední známý stav modulu
    if (temperature !== undefined) {
      module.lastTemperature = temperature;
    }

    if (accelerometer !== undefined) {
      module.lastAccelerometer = accelerometer;
    }

    module.lastSeen = measuredAtValue;
    await module.save();

    // Uložit telemetrii
    const sensorReading = await SensorReading.create({
      gatewayId,
      moduleId,

      // Lokace se bere z modulu, ne z requestu
      building: module.building,
      floor: module.floor,

      temperature,
      accelerometer,
      accelerometerAlarm,
      buttonPressed,
      measuredAt: measuredAtValue
    });

    // Spustit Alert Engine
    await AlertService.processTelemetry({
      gatewayId,
      moduleId,

      // Alert engine také dostane lokaci podle modulu
      building: module.building,
      floor: module.floor,

      temperature,
      accelerometer,
      accelerometerAlarm,
      buttonPressed,
      measuredAt: sensorReading.measuredAt
    });

    res.status(201).json(sensorReading);
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

module.exports = router;