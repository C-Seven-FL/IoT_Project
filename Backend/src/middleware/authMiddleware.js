/**
 * RBAC Middleware pro kontrolu oprávnění
 * 
 * Použití:
 * - setUserContext: aplikuj na všechny requesty
 * - requireRole: obalit routu kterou chceš chránit
 * - filterByRole: pro filtrování dat podle role
 */

/**
 * Middleware pro přihlášení uživatele (čte z session/header)
 * Pro MVP: Simulujeme přihlášeného uživatele
 * V budoucnu: Přidat JWT validaci
 */
const setUserContext = (req, res, next) => {
  // MOCK: Zatím simulujeme přihlášeného uživatele
  // V budoucnu bude z JWT tokenu nebo session
  
  // Příklad z headeru: Authorization: Bearer user_id:role
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    // V budoucnu: validovat JWT
    // Pro teď: MOCK data
    req.user = {
      id: "user-001",
      email: "admin@example.com",
      role: "ADMIN",
      assignedBuildings: [] // ADMIN vidí všechny
    };
  } else {
    // Uživatel není přihlášený
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
