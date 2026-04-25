const express = require("express");
const { Building, Module } = require("../models");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({
    message: "Module route works"
  });
});

router.post("/create", async (req, res) => {
  try {
    const { moduleId, gatewayId, buildingId, floor } = req.body;

    if (!moduleId || !gatewayId || !buildingId || floor === undefined) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "moduleId, gatewayId, buildingId and floor are required."
      });
    }

    const building = await Building.findById(buildingId);

    if (!building) {
      return res.status(404).json({
        code: "buildingNotFound",
        message: "Building was not found."
      });
    }

    const module = await Module.create({
      moduleId,
      gatewayId,
      building: buildingId,
      floor
    });

    res.status(201).json(module);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        code: "moduleAlreadyExists",
        message: "Module with this moduleId already exists."
      });
    }

    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

router.get("/list", async (req, res) => {
  try {
    const { buildingId } = req.query;

    const filter = {};

    if (buildingId) {
      filter.building = buildingId;
    }

    const modules = await Module.find(filter).sort({ floor: 1 }).lean();

    res.json({
      itemList: modules,
      total: modules.length
    });
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

module.exports = router;