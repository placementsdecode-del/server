import { randomUUID } from "node:crypto";
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
  const { externalId, orgName, orgEmail, address, location, phoneNumber, requestedFeatures } = req.body;

  if (!orgName || !orgEmail || !address || !phoneNumber) {
    throw new ApiError(400, "orgName, orgEmail, address, and phoneNumber are required");
  }

  const requestedFeatureIds = await resolveFeatureIds(requestedFeatures);

  const registration = await RegisterOrg.create({
    externalId,
    orgName,
    orgEmail,
    address,
    location,
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
  const token = randomUUID();
  const now = new Date();
  const registration = await RegisterOrg.findOneAndUpdate({
    _id: req.params.registrationId,
    status: { $in: ['pending', 'accepted'] },
    $or: [{ approvalLeaseUntil: null }, { approvalLeaseUntil: { $lt: now } }],
  }, { $set: { approvalToken: token, approvalLeaseUntil: new Date(+now + 120000) } }, { returnDocument: 'after' });
  if (!registration) throw new ApiError(409, 'This request is unavailable or approval is already in progress');

  try {
    const existingUser = await User.findOne({ email: registration.orgEmail });
    const existingOrg = await AcceptedOrganization.findOne({ registrationRequest: registration._id });
    if (existingUser && String(existingUser.organization) !== String(existingOrg?._id)) {
      throw new ApiError(409, 'The registration email already belongs to another account');
    }
    const selectedFeatures = req.body.features !== undefined ? await resolveFeatureIds(req.body.features) : registration.requestedFeatures;
    const organization = await AcceptedOrganization.findOneAndUpdate({ registrationRequest: registration._id }, {
      $setOnInsert: {
        orgName: registration.orgName, orgEmail: registration.orgEmail, address: registration.address,
        location: registration.location, phoneNumber: registration.phoneNumber, features: selectedFeatures, acceptedBy: req.user._id,
      },
    }, { upsert: true, returnDocument: 'after', runValidators: true });
    const roles = await ensureOrganizationRoles(organization._id);
    let admin = existingUser;
    let temporaryPassword: string | undefined;
    if (!admin) {
      temporaryPassword = generateTemporaryPassword();
      admin = await User.create({ organization: organization._id, name: req.body.adminName || `${registration.orgName} Admin`,
        email: registration.orgEmail, password: temporaryPassword, phoneNumber: registration.phoneNumber,
        role: roles.admin._id, roleName: 'admin', createdBy: req.user._id, mustChangePassword: true });
    } else if (!organization.credentialsSentAt && admin.mustChangePassword) {
      temporaryPassword = generateTemporaryPassword();
      admin.password = temporaryPassword;
      await admin.save();
    }
    organization.adminUser = admin._id;
    await organization.save();
    registration.status = 'accepted';
    registration.discussionNotes = req.body.discussionNotes || registration.discussionNotes;
    registration.reviewedBy = req.user._id;
    registration.reviewedAt = now;
    registration.acceptedOrganization = organization._id;
    await registration.save();

    let message = 'Organization approved';
    if (temporaryPassword) {
      try {
        const delivery = await sendOrganizationCredentials({ to: admin.email, orgName: organization.orgName, email: admin.email, password: temporaryPassword });
        if (!delivery.preview) {
          organization.credentialsSentAt = new Date();
          await organization.save();
          temporaryPassword = undefined;
          message = 'Organization approved and admin credentials sent';
        } else message = 'Organization approved. Email is unavailable. Share the temporary credentials with the organization admin.';
      } catch {
        message = 'Organization approved. Email delivery failed. Share the temporary credentials with the organization admin.';
      }
    }
    res.json({ message, registration, organization, admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.roleName },
      ...(temporaryPassword ? { temporaryPassword } : {}) });
  } finally {
    await RegisterOrg.updateOne({ _id: registration._id, approvalToken: token }, { $unset: { approvalToken: 1, approvalLeaseUntil: 1 } });
  }
});

const rejectRegistration = asyncHandler(async (req, res) => {
  const registration = await RegisterOrg.findOneAndUpdate({
    _id: req.params.registrationId, status: 'pending',
    $or: [{ approvalLeaseUntil: null }, { approvalLeaseUntil: { $lt: new Date() } }],
  }, { $set: { status: 'rejected', discussionNotes: req.body.discussionNotes || '', reviewedBy: req.user._id, reviewedAt: new Date() } }, { returnDocument: 'after' });
  if (!registration) throw new ApiError(409, 'Only pending requests without an approval in progress can be rejected');

  res.json({ message: "Organization registration rejected", registration });
});

export {
  createRegistration,
  listRegistrations,
  getRegistration,
  approveRegistration,
  rejectRegistration,
};
