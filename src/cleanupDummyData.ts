import "dotenv/config";

import mongoose from "mongoose";

import connectDB from "./config/db";
import AcceptedOrganization from "./models/AcceptedOrganization";
import Assessment from "./models/Assessment";
import RegisterOrg from "./models/RegisterOrg";
import Role from "./models/Role";
import Section from "./models/Section";
import User from "./models/User";

const SUPERADMIN_EMAIL = "superadmin@gmail.com";
const DUMMY_SUPERADMIN_EMAILS = ["superadmin@example.com"];
const DUMMY_ORG_NAMES = ["Dev Test Organization", "Demo Placement Institute", "MTIET"];
const DUMMY_ORG_EMAILS = ["admin@gmail.com", "test@gmail.com"];
const DUMMY_USER_EMAILS = ["admin@gmail.com", "teacher@gmail.com", "student@gmail.com"];
const DUMMY_SECTION_CODES = ["CSE-A"];
const DUMMY_SECTION_NAMES = ["CSE Section A"];
const DUMMY_ASSESSMENT_TITLES = ["Demo Aptitude Assessment"];

async function countState() {
  return {
    users: await User.countDocuments(),
    preservedSuperadmins: await User.countDocuments({
      email: SUPERADMIN_EMAIL,
      roleName: "superadmin",
    }),
    organizationRoles: await Role.countDocuments({ organization: { $ne: null } }),
    registrations: await RegisterOrg.countDocuments(),
    organizations: await AcceptedOrganization.countDocuments(),
    sections: await Section.countDocuments(),
    assessments: await Assessment.countDocuments(),
  };
}

async function cleanupDummyData() {
  await connectDB();

  const before = await countState();

  const dummyRegistrations = await RegisterOrg.find({
    $or: [{ orgName: { $in: DUMMY_ORG_NAMES } }, { orgEmail: { $in: DUMMY_ORG_EMAILS } }],
  }).select("_id acceptedOrganization");
  const acceptedOrganizationIds = dummyRegistrations
    .map((registration: any) => registration.acceptedOrganization)
    .filter(Boolean);

  const dummyOrganizations = await AcceptedOrganization.find({
    $or: [
      { _id: { $in: acceptedOrganizationIds } },
      { orgName: { $in: DUMMY_ORG_NAMES } },
      { orgEmail: { $in: DUMMY_ORG_EMAILS } },
    ],
  }).select("_id");
  const organizationIds = dummyOrganizations.map((organization) => organization._id);

  const [
    assessmentResult,
    sectionResult,
    nonSuperadminUserResult,
    extraSuperadminResult,
    organizationRoleResult,
    acceptedOrganizationResult,
    registrationResult,
  ] = await Promise.all([
    Assessment.deleteMany({
      $or: [{ organization: { $in: organizationIds } }, { title: { $in: DUMMY_ASSESSMENT_TITLES } }],
    }),
    Section.deleteMany({
      $or: [
        { organization: { $in: organizationIds } },
        { code: { $in: DUMMY_SECTION_CODES } },
        { name: { $in: DUMMY_SECTION_NAMES } },
      ],
    }),
    User.deleteMany({
      roleName: { $ne: "superadmin" },
      $or: [{ email: { $in: DUMMY_USER_EMAILS } }, { organization: { $in: organizationIds } }],
    }),
    User.deleteMany({
      roleName: "superadmin",
      email: { $in: DUMMY_SUPERADMIN_EMAILS },
    }),
    Role.deleteMany({ organization: { $in: organizationIds } }),
    AcceptedOrganization.deleteMany({ _id: { $in: organizationIds } }),
    RegisterOrg.deleteMany({
      $or: [{ orgName: { $in: DUMMY_ORG_NAMES } }, { orgEmail: { $in: DUMMY_ORG_EMAILS } }],
    }),
  ]);

  const preservedSuperadmin = await User.findOne({
    email: SUPERADMIN_EMAIL,
    roleName: "superadmin",
  });

  if (preservedSuperadmin) {
    preservedSuperadmin.organization = null;
    preservedSuperadmin.section = null;
    preservedSuperadmin.createdBy = null;
    preservedSuperadmin.status = "active";
    preservedSuperadmin.mustChangePassword = false;
    await preservedSuperadmin.save();
  }

  const after = await countState();

  console.log(
    JSON.stringify(
      {
        before,
        deleted: {
          assessments: assessmentResult.deletedCount,
          sections: sectionResult.deletedCount,
          users: nonSuperadminUserResult.deletedCount + extraSuperadminResult.deletedCount,
          organizationRoles: organizationRoleResult.deletedCount,
          organizations: acceptedOrganizationResult.deletedCount,
          registrations: registrationResult.deletedCount,
        },
        after,
        preservedSuperadmin: preservedSuperadmin
          ? {
              email: preservedSuperadmin.email,
              role: preservedSuperadmin.roleName,
              status: preservedSuperadmin.status,
            }
          : null,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

cleanupDummyData().catch(async (error) => {
  console.error("Cleanup failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
