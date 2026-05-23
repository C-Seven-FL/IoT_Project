const express = require("express");
const { Alert } = require("../models");
const AlertService = require("../services/alertService");
const { filterByRole } = require("../middleware/authMiddleware");

const router = express.Router();


router.get("/list", filterByRole, async (req, res) => {
  try {
    const { buildingId, status } = req.query;
    const { role, assignedBuildings } = req.userFilter;

    const filter = {};

    // ADMIN a RESCUER vidí všechny alerty.
    // USER vidí pouze alerty ze svých přiřazených budov.
    if (role === "USER") {
      const assigned = assignedBuildings || [];

      if (assigned.length === 0) {
        return res.json({
          itemList: [],
          total: 0
        });
      }

      if (buildingId) {
        const canAccessBuilding = assigned.some(
          (id) => String(id) === String(buildingId)
        );

        if (!canAccessBuilding) {
          return res.json({
            itemList: [],
            total: 0
          });
        }

        filter.building = buildingId;
      } else {
        filter.building = { $in: assigned };
      }
    } else {
      // ADMIN / RESCUER / SYSTEM vidí všechno,
      // ale pokud přijde buildingId, můžou filtrovat konkrétní budovu.
      if (buildingId) {
        filter.building = buildingId;
      }
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
