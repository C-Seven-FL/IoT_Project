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
 * Token formát (mock JWT): Bearer <userId>
 * Backend si podle něj načte aktuální data o uživateli z DB.
 * V budoucnu: nahradit za skutečný JWT (jwt.verify) — bez změn ostatního kódu.
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret_key");
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      req.user = null;
      return next();
    }
    req.user = {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      assignedBuildings: (user.assignedBuildings || []).map((b) => b.toString())
    };
  } catch (err) {
    // Token není validní ObjectId → považujeme za nepřihlášeného (ne 500)
    req.user = null;
  }

  next();
};

/**
 * Middleware pro kontrolu role
 * Použití: router.get("/list", requireRole(["ADMIN", "MANAGER"]), handler)
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const user = req.user;

    // Kontrola: Je uživatel přihlášený?
    if (!user) {
      return res.status(401).json({
        code: "unauthorized",
        message: "User not authenticated"
      });
    }

    // Kontrola: Má uživatel požadovanou roli?
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
 * Např. USER vidí jen své budovy
 */
const filterByRole = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      code: "unauthorized",
      message: "User not authenticated"
    });
  }

  // Uložit informaci pro route handler
  req.userFilter = {
    role: user.role,
    assignedBuildings: user.assignedBuildings,
    userId: user.id
  };

  next();
};

module.exports = {
  setUserContext,
  requireRole,
  filterByRole
};
