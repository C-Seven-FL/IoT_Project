/**
 * RBAC Middleware pro kontrolu oprávnění
 *
 * Použití:
 * - setUserContext: aplikuj na všechny requesty
 * - requireRole: obalit routu kterou chceš chránit
 * - filterByRole: pro filtrování dat podle role
 */

/**
 * Middleware pro přihlášení uživatele (čte z Authorization headeru).
 *
 * Token formát: Bearer <JWT>
 * Backend si podle tokenu načte aktuální data o uživateli z DB.
 */
const jwt = require("jsonwebtoken");
const { User } = require("../models");

const setUserContext = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback_secret_key"
    );

    const user = await User.findById(decoded.id).select("-password");

    if (!user || user.isActive === false) {
      req.user = null;
      return next();
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,

      assignedBuildings: (user.assignedBuildings || []).map((b) =>
        b.toString()
      ),

      requestedBuilding: user.requestedBuilding
        ? user.requestedBuilding.toString()
        : null,

      // Starší uživatelé v DB to nemusí mít, proto fallback na APPROVED.
      approvalStatus: user.approvalStatus || "APPROVED"
    };
  } catch (err) {
    req.user = null;
  }

  next();
};

/**
 * Middleware pro kontrolu role
 * Použití: router.get("/list", requireRole(["ADMIN"]), handler)
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        code: "unauthorized",
        message: "User not authenticated"
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        code: "forbidden",
        message: `Insufficient permissions. Required roles: ${allowedRoles.join(", ")}`
      });
    }

    next();
  };
};

/**
 * Middleware pro filtrování dat podle role
 * Např. USER vidí jen své schválené budovy.
 */
const filterByRole = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      code: "unauthorized",
      message: "User not authenticated"
    });
  }

  req.userFilter = {
    role: user.role,
    assignedBuildings: user.assignedBuildings,
    requestedBuilding: user.requestedBuilding,
    approvalStatus: user.approvalStatus,
    userId: user.id
  };

  next();
};

module.exports = {
  setUserContext,
  requireRole,
  filterByRole
};