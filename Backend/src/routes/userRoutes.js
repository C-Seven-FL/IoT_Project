const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Building } = require("../models");
const { requireRole, filterByRole } = require("../middleware/authMiddleware");

const router = express.Router();

// Role povolené při self-registration. Ostatní (ADMIN, SYSTEM) může vytvářet jen ADMIN.
const PUBLIC_REGISTRATION_ROLES = ["USER", "RESCUER"];
const ALL_ROLES = ["ADMIN", "USER", "RESCUER", "SYSTEM"];

// ==================== PUBLIC ROUTES ====================

/**
 * POST /user/register
 * Registrace nového uživatele
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, building } = req.body;

    // Validace povinných polí
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "Email, password, firstName and lastName are required."
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "Password must be at least 6 characters."
      });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: "Email is not valid."
      });
    }

    // Validace role — public registration jen USER nebo RESCUER
    const requestedRole = role || "USER";
    if (!PUBLIC_REGISTRATION_ROLES.includes(requestedRole)) {
      return res.status(400).json({
        code: "invalidRole",
        message: `Public registration allows only roles: ${PUBLIC_REGISTRATION_ROLES.join(", ")}`
      });
    }

    // USER si při registraci vybere budovu,
    // ale přístup získá až po schválení adminem.
    let assignedBuildings = [];
    let requestedBuilding = null;
    let approvalStatus = "APPROVED";

    if (requestedRole === "USER") {
      if (!building) {
        return res.status(400).json({
        code: "buildingRequired",
        message: "Building selection is required for USER role."
      });
    }

    const b = await Building.findById(building).catch(() => null);

    if (!b) {
      return res.status(404).json({
        code: "buildingDoesNotExist",
        message: "Selected building does not exist."
      });
    }

    requestedBuilding = b._id;
    assignedBuildings = [];
    approvalStatus = "PENDING";
    }

    // RESCUER zatím zůstává bez assignedBuildings,
    // protože podle vašeho filtrování vidí všechny budovy.

    // Duplicita emailu
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        code: "userAlreadyExists",
        message: "User with this email already exists."
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role: requestedRole,
      assignedBuildings,
      requestedBuilding,
      approvalStatus
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    const token = jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_SECRET || "fallback_secret_key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      ...userResponse,
      token
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        code: "userAlreadyExists",
        message: "User with this email already exists."
      });
    }
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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
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

    const token = jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_SECRET || "fallback_secret_key",
      { expiresIn: "7d" }
    );

    res.json({
      ...userResponse,
      token
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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        code: "unauthorized",
        message: "User not authenticated."
      });
    }

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
 * GET /user/pending-approvals
 * Seznam uživatelů čekajících na schválení přístupu k budově.
 */
router.get("/pending-approvals", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const users = await User.find({
      role: "USER",
      approvalStatus: "PENDING"
    })
      .select("-password")
      .populate("requestedBuilding", "name address floors")
      .sort({ createdAt: -1 })
      .lean();

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
 * POST /user/:userId/approve-building
 * Schválit USERovi přístup k požadované budově.
 */
router.post("/:userId/approve-building", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        code: "userNotFound",
        message: "User not found."
      });
    }

    if (user.role !== "USER") {
      return res.status(400).json({
        code: "invalidUserRole",
        message: "Only USER building access can be approved."
      });
    }

    if (!user.requestedBuilding) {
      return res.status(400).json({
        code: "requestedBuildingMissing",
        message: "User does not have requested building."
      });
    }

    user.approvalStatus = "APPROVED";
    user.assignedBuildings = [user.requestedBuilding];
    user.approvedBy = req.user.id;
    user.approvedAt = new Date();
    user.rejectedAt = null;

    await user.save();

    const userResponse = await User.findById(user._id)
      .select("-password")
      .populate("requestedBuilding", "name address floors")
      .lean();

    res.json(userResponse);
  } catch (error) {
    res.status(500).json({
      code: "internalError",
      message: error.message
    });
  }
});

/**
 * POST /user/:userId/reject-building
 * Zamítnout USERovi přístup k požadované budově.
 */
router.post("/:userId/reject-building", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        code: "userNotFound",
        message: "User not found."
      });
    }

    if (user.role !== "USER") {
      return res.status(400).json({
        code: "invalidUserRole",
        message: "Only USER building access can be rejected."
      });
    }

    user.approvalStatus = "REJECTED";
    user.assignedBuildings = [];
    user.approvedBy = null;
    user.approvedAt = null;
    user.rejectedAt = new Date();

    await user.save();

    const userResponse = await User.findById(user._id)
      .select("-password")
      .populate("requestedBuilding", "name address floors")
      .lean();

    res.json(userResponse);
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

    if (!role || !ALL_ROLES.includes(role)) {
      return res.status(400).json({
        code: "invalidDtoIn",
        message: `Invalid role. Must be one of: ${ALL_ROLES.join(", ")}`
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
