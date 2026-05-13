const express = require("express");
const { Alert } = require("../models");
const AlertService = require("../services/alertService");
const { filterByRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({
    message: "Alert route works"
  });
});


router.get("/list", filterByRole, async (req, res) => {
  try {
    const { buildingId, status } = req.query;
    const { role, assignedBuildings } = req.userFilter;

    // Sestavit filtr
    const filter = {};

    // Pokud user není ADMIN, vidí jen své budovy
    if (role !== "ADMIN") {
      filter.building = { $in: assignedBuildings };
    } else if (buildingId) {
      // ADMIN může filtrovat specifickou budovu
      filter.building = buildingId;
    }

    // Filtr podle status
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


router.post("/resolve", filterByRole, async (req, res) => {
  try {
    const { alertId } = req.body;
    const { role } = req.userFilter;

    if (!alertId) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "alertId is required."
      });
    }

    // Vyřešit alert (Alert Engine se postará o update stavů)
    const resolvedAlert = await AlertService.resolveAlert(alertId);

    res.json(resolvedAlert);
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

module.exports = router;
