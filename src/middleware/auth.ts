import jwt from "jsonwebtoken";

import User from "../models/User";
import AcceptedOrganization from "../models/AcceptedOrganization";
import ApiError from "../utils/apiError";

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, "Authentication token is required"));

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
  if (typeof payload === "string" || !payload.sub || !/^[a-f\d]{24}$/i.test(payload.sub)) {
    return next(new ApiError(401, "Invalid or expired token"));
  }

  const user = await User.findById(payload.sub).populate("role");
  if (!user || user.status !== "active") return next(new ApiError(401, "User is not active or no longer exists"));
  if (user.roleName !== 'superadmin' && !await AcceptedOrganization.exists({ _id: user.organization, status: 'active' })) {
    return next(new ApiError(403, 'Organization access is suspended or unavailable'));
  }
  req.user = user;
  next();
}

function requirePermission(...permissions: string[]) {
  return (req, _res, next) => {
    if (req.user.roleName === 'superadmin' || permissions.some(permission => req.user.role?.permissions?.includes(permission))) return next();
    next(new ApiError(403, 'Your role does not allow this action'));
  };
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

export { requireAuth, requireRoles, requirePermission, requireOrganizationAccess };
