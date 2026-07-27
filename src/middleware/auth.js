const jwt = require("jsonwebtoken");
const ApiError = require("../utils/apiError");
const User = require("../models/User");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new ApiError(401, "Authentication token is required");
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).populate("role");

    if (!user || user.status !== "active") {
      throw new ApiError(401, "User is not active or no longer exists");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error.statusCode ? error : new ApiError(401, "Invalid or expired token"));
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.roleName)) {
      return next(new ApiError(403, "You do not have permission for this action"));
    }

    next();
  };
}

function requireOrganizationAccess(req, res, next) {
  if (req.user.roleName === "superadmin") {
    return next();
  }

  const organizationId = req.params.organizationId || req.body.organization;

  if (!organizationId || !req.user.organization || req.user.organization.toString() !== organizationId) {
    return next(new ApiError(403, "You can only access your own organization"));
  }

  next();
}

module.exports = { requireAuth, requireRoles, requireOrganizationAccess };
