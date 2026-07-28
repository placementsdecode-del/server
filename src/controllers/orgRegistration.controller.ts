import AcceptedOrganization from "../models/AcceptedOrganization";
import RegisterOrg from "../models/RegisterOrg";
import User from "../models/User";
import { resolveFeatureIds } from "../services/feature.service";
import { sendOrganizationCredentials } from "../services/mail.service";
import { ensureOrganizationRoles } from "../services/rbac.service";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";
import { generateTemporaryPassword } from "../utils/password";

const createRegistration = asyncHandler(async (req, res) => {
  const { id, externalId, orgName, orgEmail, address, phoneNumber, requestedFeatures } = req.body;

  if (!orgName || !orgEmail || !address || !phoneNumber) {
    throw new ApiError(400, "orgName, orgEmail, address, and phoneNumber are required");
  }

  const requestedFeatureIds = await resolveFeatureIds(requestedFeatures);

  const registration = await RegisterOrg.create({
    externalId: externalId || id,
    orgName,
    orgEmail,
    address,
    phoneNumber,
    requestedFeatures: requestedFeatureIds,
  });

  res.status(201).json({
    message: "Organization registration submitted for superadmin review",
    registration,
  });
});

const listRegistrations = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = typeof status === "string" ? { status } : {};
  const registrations = await RegisterOrg.find(filter as any)
    .populate("requestedFeatures")
    .populate("reviewedBy", "name email roleName")
    .populate("acceptedOrganization")
    .sort({ createdAt: -1 });

  res.json({ registrations });
});

const getRegistration = asyncHandler(async (req, res) => {
  const registration = await RegisterOrg.findById(req.params.registrationId)
    .populate("requestedFeatures")
    .populate("reviewedBy", "name email roleName")
    .populate("acceptedOrganization");

  if (!registration) {
    throw new ApiError(404, "Registration not found");
  }

  res.json({ registration });
});

const approveRegistration = asyncHandler(async (req, res) => {
  const { features, adminName, discussionNotes } = req.body;

  const registration = await RegisterOrg.findById(req.params.registrationId);

  if (!registration) {
    throw new ApiError(404, "Registration not found");
  }

  if (registration.status !== "pending") {
    throw new ApiError(409, "Only pending registrations can be approved");
  }

  const selectedFeatures = features ? await resolveFeatureIds(features) : registration.requestedFeatures;

  const organization = await AcceptedOrganization.create({
    registrationRequest: registration._id,
    orgName: registration.orgName,
    orgEmail: registration.orgEmail,
    address: registration.address,
    phoneNumber: registration.phoneNumber,
    features: selectedFeatures,
    acceptedBy: req.user._id,
  });

  const roles = await ensureOrganizationRoles(organization._id);
  const temporaryPassword = generateTemporaryPassword();

  const admin = await User.create({
    organization: organization._id,
    name: adminName || `${registration.orgName} Admin`,
    email: registration.orgEmail,
    password: temporaryPassword,
    phoneNumber: registration.phoneNumber,
    role: roles.admin._id,
    roleName: "admin",
    createdBy: req.user._id,
    mustChangePassword: true,
  });

  organization.adminUser = admin._id;
  organization.credentialsSentAt = new Date();
  await organization.save();

  registration.status = "accepted";
  registration.discussionNotes = discussionNotes || registration.discussionNotes;
  registration.reviewedBy = req.user._id;
  registration.reviewedAt = new Date();
  registration.acceptedOrganization = organization._id;
  await registration.save();

  await sendOrganizationCredentials({
    to: admin.email,
    orgName: organization.orgName,
    email: admin.email,
    password: temporaryPassword,
  });

  res.json({
    message: "Organization approved and admin credentials sent",
    registration,
    organization,
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.roleName,
    },
  });
});

const rejectRegistration = asyncHandler(async (req, res) => {
  const registration = await RegisterOrg.findById(req.params.registrationId);

  if (!registration) {
    throw new ApiError(404, "Registration not found");
  }

  if (registration.status !== "pending") {
    throw new ApiError(409, "Only pending registrations can be rejected");
  }

  registration.status = "rejected";
  registration.discussionNotes = req.body.discussionNotes || registration.discussionNotes;
  registration.reviewedBy = req.user._id;
  registration.reviewedAt = new Date();
  await registration.save();

  res.json({ message: "Organization registration rejected", registration });
});

export {
  createRegistration,
  listRegistrations,
  getRegistration,
  approveRegistration,
  rejectRegistration,
};
