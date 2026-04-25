const express = require("express");
const { Building, Module, Alert } = require("../models");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({
    message: "Building route works"
  });
});

router.post("/create", async (req, res) => {
  try {
    const { name, address, floors } = req.body;

    if (!name || !floors) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "Name and floors are required."
      });
    }

    const building = await Building.create({
      name,
      address,
      floors
    });

    res.status(201).json(building);
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

router.get("/getState", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "Building id is required."
      });
    }

    const building = await Building.findById(id).lean();

    if (!building) {
      return res.status(404).json({
        code: "buildingNotFound",
        message: "Building was not found."
      });
    }

    const modules = await Module.find({ building: id }).lean();

    const activeAlerts = await Alert.find({
      building: id,
      status: "ACTIVE"
    })
      .sort({ createdAt: -1 })
      .lean();

    function getModuleDisplayStatus(module, moduleAlerts) {
      if (moduleAlerts.length > 0) {
        return "DANGER";
      }

      if (module.lastTemperature !== null && module.lastTemperature >= 45) {
        return "WARNING";
      }

      if (module.status === "OFFLINE") {
        return "OFFLINE";
      }

      return "ONLINE";
    }

    const floors = [];

    for (let floor = 1; floor <= building.floors; floor++) {
      const floorModules = modules.filter((module) => module.floor === floor);
      const floorAlerts = activeAlerts.filter((alert) => alert.floor === floor);

      const mappedModules = floorModules.map((module) => {
        const moduleAlerts = floorAlerts.filter(
          (alert) => alert.moduleId === module.moduleId
        );

        return {
          moduleId: module.moduleId,
          gatewayId: module.gatewayId,
          status: getModuleDisplayStatus(module, moduleAlerts),
          lastSeen: module.lastSeen,
          lastTemperature: module.lastTemperature,
          lastAccelerometer: module.lastAccelerometer
        };
      });

      let floorStatus = "OK";

      if (floorAlerts.length > 0) {
        floorStatus = "DANGER";
      } else if (mappedModules.some((module) => module.status === "WARNING")) {
        floorStatus = "WARNING";
      }

      floors.push({
        floor,
        status: floorStatus,
        modules: mappedModules,
        activeAlerts: floorAlerts
      });
    }

    let buildingStatus = "OK";

    if (activeAlerts.length > 0) {
      buildingStatus = "DANGER";
    } else if (floors.some((floor) => floor.status === "WARNING")) {
      buildingStatus = "WARNING";
    }

    res.json({
      building: {
        id: building._id,
        name: building.name,
        address: building.address,
        floors: building.floors,
        status: buildingStatus
      },
      floors,
      activeAlerts
    });
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

module.exports = router;