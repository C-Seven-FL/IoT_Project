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
    const { name, address, floors, gateways } = req.body;

    if (!name || !floors) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "Name and floors are required."
      });
    }

    const building = await Building.create({
      name,
      address,
      floors,
      gateways: Array.isArray(gateways) ? gateways : []
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

    function hasTemperatureValue(value) {
      return value !== null && value !== undefined;
    }

    function getAlertStatus(alerts = []) {
      const hasDanger = alerts.some((alert) =>
        alert.type === "SOS" ||
        alert.type === "FIRE" ||
        alert.type === "EARTHQUAKE" ||
        alert.severity === "CRITICAL" ||
        alert.severity === "DANGER"
      );

      if (hasDanger) {
        return "DANGER";
      }

      const hasWarning = alerts.some((alert) =>
        alert.type === "TEMPERATURE_WARNING" ||
        alert.severity === "HIGH" ||
        alert.severity === "WARNING"
      );

      if (hasWarning) {
        return "WARNING";
      }

      return "OK";
    }

    function getModuleDisplayStatus(module, moduleAlerts) {
      const alertStatus = getAlertStatus(moduleAlerts);

      if (alertStatus !== "OK") {
        return alertStatus;
      }

      if (hasTemperatureValue(module.lastTemperature) && module.lastTemperature >= 60) {
        return "DANGER";
      }

      if (hasTemperatureValue(module.lastTemperature) && module.lastTemperature >= 45) {
        return "WARNING";
      }

      if (module.status === "OFFLINE") {
        return "OFFLINE";
      }

      return "ONLINE";
    }

    function getFloorStatus(floorAlerts, mappedModules) {
      const alertStatus = getAlertStatus(floorAlerts);

      if (alertStatus === "DANGER") {
        return "DANGER";
      }

      if (mappedModules.some((module) => module.status === "DANGER")) {
        return "DANGER";
      }

      if (
        alertStatus === "WARNING" ||
        mappedModules.some((module) => module.status === "WARNING")
      ) {
        return "WARNING";
      }

      return "OK";
    }

    function getBuildingStatus(activeAlerts, floors) {
      const alertStatus = getAlertStatus(activeAlerts);

      if (alertStatus === "DANGER") {
        return "DANGER";
      }

      if (floors.some((floor) => floor.status === "DANGER")) {
        return "DANGER";
      }

      if (
        alertStatus === "WARNING" ||
        floors.some((floor) => floor.status === "WARNING")
      ) {
        return "WARNING";
      }

      return "OK";
    }

    const floors = [];

    for (let floor = 1; floor <= building.floors; floor++) {
      const floorModules = modules.filter((module) => Number(module.floor) === floor);
      const floorAlerts = activeAlerts.filter((alert) => Number(alert.floor) === floor);

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

      const floorStatus = getFloorStatus(floorAlerts, mappedModules);

      floors.push({
        floor,
        status: floorStatus,
        modules: mappedModules,
        activeAlerts: floorAlerts
      });
    }

    const buildingStatus = getBuildingStatus(activeAlerts, floors);

    res.json({
      building: {
        id: building._id,
        name: building.name,
        address: building.address,
        floors: building.floors,
        status: buildingStatus,
        gateways: building.gateways || []
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

// USER (civil) vidí jen své přiřazené budovy.
// RESCUER + ADMIN + MANAGER + TECHNICIAN vidí všechny.
router.get("/list", async (req, res) => {
  try {
    const user = req.user;
    let filter = {};

    if (user && user.role === "USER") {
      const assigned = (user.assignedBuildings || []);
      if (assigned.length === 0) {
        return res.json({ itemList: [], total: 0 });
      }
      filter._id = { $in: assigned };
    }
    // RESCUER / ADMIN / MANAGER / TECHNICIAN → bez filtru = vše

    const buildings = await Building.find(filter).sort({ createdAt: -1 }).lean();

    const buildingsWithStats = await Promise.all(
      buildings.map(async (building) => {
        const moduleCount = await Module.countDocuments({ building: building._id });
        const activeAlertCount = await Alert.countDocuments({
          building: building._id,
          status: "ACTIVE"
        });
        return { ...building, moduleCount, activeAlertCount };
      })
    );

    res.json({ itemList: buildingsWithStats, total: buildingsWithStats.length });
  } catch (error) {
    res.status(500).json({ code: "internalError", message: error.message });
  }
});

router.put("/update", async (req, res) => {
  try {
    const { id, name, address, floors, gateways } = req.body;
    if (!id) {
      return res.status(400).json({ code: "invalidDtoIn", message: "Building id is required." });
    }
    const building = await Building.findById(id);
    if (!building) {
      return res.status(404).json({ code: "buildingNotFound", message: "Building was not found." });
    }
    if (name !== undefined) building.name = name;
    if (address !== undefined) building.address = address;
    if (floors !== undefined) building.floors = floors;
    if (gateways !== undefined) building.gateways = Array.isArray(gateways) ? gateways : [];
    await building.save();
    res.json(building);
  } catch (error) {
    res.status(500).json({ code: "internalError", message: error.message });
  }
});

router.delete("/delete", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ code: "invalidDtoIn", message: "Building id is required." });
    }
    const building = await Building.findById(id);
    if (!building) {
      return res.status(404).json({ code: "buildingNotFound", message: "Building was not found." });
    }
    await Alert.deleteMany({ building: id });
    await Module.deleteMany({ building: id });
    await Building.findByIdAndDelete(id);
    res.json({ message: "Building and all related data were deleted." });
  } catch (error) {
    res.status(500).json({ code: "internalError", message: error.message });
  }
});

module.exports = router;