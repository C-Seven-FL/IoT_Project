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
    const { gatewayId, moduleId, building, floor, temperature, accelerometer, buttonPressed, measuredAt } = req.body;

    // Validace
    if (!gatewayId || !moduleId || !building || floor === undefined) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "gatewayId, moduleId, building and floor are required."
      });
    }

    // Najít modul (ověřit existenci)
    const module = await Module.findOne({ moduleId });
    if (!module) {
      return res.status(404).json({
        code: "moduleNotFound",
        message: "Module not found."
      });
    }

    // Uložit telemetrii
    const sensorReading = await SensorReading.create({
      gatewayId,
      moduleId,
      building,
      floor,
      temperature,
      accelerometer,
      buttonPressed,
      measuredAt: measuredAt || new Date()
    });

    // Spustit Alert Engine!
    await AlertService.processTelemetry({
      gatewayId,
      moduleId,
      building,
      floor,
      temperature,
      accelerometer,
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