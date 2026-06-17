const express = require("express");
const { User } = require("../models");
const { requireRole, filterByRole } = require("../middleware/authMiddleware");

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

/**
 * POST /user/register
 * Registrace nového uživatele
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validace
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "Email, password, firstName and lastName are required."
      });
    }

    // Kontrola: Existuje již uživatel s tímto emailem?
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        code: "userAlreadyExists",
        message: "User with this email already exists."
      });
    }

    // Vytvoření uživatele
    // TODO: Hashovat heslo (bcrypt)
    const user = await User.create({
      email,
      password, // TODO: HASH!
      firstName,
      lastName,
      role: "USER", // Default role
      assignedBuildings: []
    });

    // Vrátit bez hesla
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

/**
 * POST /user/login
 * Přihlášení uživatele
 * TODO: Vrátit JWT token v budoucnu
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "Email and password are required."
      });
    }

    // Najít uživatele
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        code: "invalidCredentials",
        message: "Invalid email or password."
      });
    }

    // TODO: Ověřit heslo (bcrypt.compare)
    // Zatím simulujeme
    if (user.password !== password) {
      return res.status(401).json({
        code: "invalidCredentials",
        message: "Invalid email or password."
      });
    }

    // Aktualizovat lastLogin
    user.lastLogin = new Date();
    await user.save();

    // Vrátit bez hesla
    const userResponse = user.toObject();
    delete userResponse.password;

    // TODO: Vygenerovat JWT token
    res.json({
      ...userResponse,
      token: "TODO_JWT_TOKEN" // Placeholder
    });
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

// ==================== AUTHENTICATED ROUTES ====================

/**
 * GET /user/me
 * Můj profil (přihlášený uživatel)
 */
router.get("/me", filterByRole, async (req, res) => {
  try {
    // V budoucnu: Vzít ID z JWT tokenu
    // Zatím mock
    const userId = "user-001";

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        code: "userNotFound",
        message: "User not found."
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

// ==================== ADMIN ONLY ROUTES ====================

/**
 * GET /user/list
 * Všichni uživatelé (pouze ADMIN)
 */
router.get("/list", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const users = await User.find().select("-password").lean();

    res.json({
      itemList: users,
      total: users.length
    });
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

/**
 * PUT /user/:userId/role
 * Změnit roli uživatele (pouze ADMIN)
 */
router.put("/:userId/role", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !["ADMIN", "MANAGER", "USER", "TECHNICIAN"].includes(role)) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "Invalid role. Must be: ADMIN, MANAGER, USER, or TECHNICIAN"
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        code: "userNotFound",
        message: "User not found."
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

/**
 * POST /user/:userId/buildings
 * Přiřadit budovy uživateli (ADMIN/MANAGER)
 */
router.post(
  "/:userId/buildings",
  requireRole(["ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { buildingIds } = req.body;

      if (!buildingIds || !Array.isArray(buildingIds)) {
        return res.status(400).json({
          code: "invalidDtoIn",
          message: "buildingIds must be an array."
        });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { assignedBuildings: buildingIds },
        { new: true }
      ).select("-password");

      if (!user) {
        return res.status(404).json({
          code: "userNotFound",
          message: "User not found."
        });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({
        code: "internalError",
        message: error.message
      });
    }
  }
);

/**
 * DELETE /user/:userId
 * Smazat uživatele (pouze ADMIN)
 */
router.delete("/:userId", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        code: "userNotFound",
        message: "User not found."
      });
    }

    res.json({
      code: "success",
      message: "User deleted successfully."
    });
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

module.exports = router;
