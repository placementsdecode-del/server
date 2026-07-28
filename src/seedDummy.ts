import "dotenv/config";

import bcrypt from "bcryptjs";

import connectDB from "./config/db";
import AcceptedOrganization from "./models/AcceptedOrganization";
import Feature from "./models/Feature";
import RegisterOrg from "./models/RegisterOrg";
import User from "./models/User";
import { ensureDefaultFeatures } from "./services/feature.service";
import { ensureOrganizationRoles, ensureRole } from "./services/rbac.service";

const dummyPassword = "Password123!";

async function seedDummyData() {
  await connectDB();

  await ensureDefaultFeatures();
  const hashedPassword = await bcrypt.hash(dummyPassword, 12);

  const superadminRole = await ensureRole("superadmin", null, true);
  const superadmin = await User.findOneAndUpdate(
    { email: "superadmin@placementdecode.test" },
    {
      $setOnInsert: {
        name: "Dummy Super Admin",
        email: "superadmin@placementdecode.test",
        password: hashedPassword,
        role: superadminRole._id,
        roleName: "superadmin",
        mustChangePassword: false,
      },
    },
    { upsert: true, new: true }
  );

  const selectedFeatures = await Feature.find({
    key: { $in: ["student-workspace", "assessments", "analytics"] },
  });

  const pendingRegistration = await RegisterOrg.findOneAndUpdate(
    { externalId: "DUMMY-PENDING-ORG" },
    {
      $setOnInsert: {
        externalId: "DUMMY-PENDING-ORG",
        orgName: "Pending Demo College",
        orgEmail: "pending-admin@demo-college.test",
        address: "Demo Road, Bengaluru",
        phoneNumber: "+919900001111",
        requestedFeatures: selectedFeatures.map((feature) => feature._id),
        status: "pending",
      },
    },
    { upsert: true, new: true }
  );

  const acceptedRegistration = await RegisterOrg.findOneAndUpdate(
    { externalId: "DUMMY-ACCEPTED-ORG" },
    {
      $setOnInsert: {
        externalId: "DUMMY-ACCEPTED-ORG",
        orgName: "Accepted Demo University",
        orgEmail: "admin@accepted-demo.test",
        address: "Demo Tech Park, Pune",
        phoneNumber: "+919900002222",
        requestedFeatures: selectedFeatures.map((feature) => feature._id),
        status: "accepted",
        discussionNotes: "Dummy organization approved for frontend integration testing.",
        reviewedBy: superadmin._id,
        reviewedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  let organization = await AcceptedOrganization.findOne({
    registrationRequest: acceptedRegistration._id,
  });

  if (!organization) {
    organization = await AcceptedOrganization.create({
      registrationRequest: acceptedRegistration._id,
      orgName: acceptedRegistration.orgName,
      orgEmail: acceptedRegistration.orgEmail,
      address: acceptedRegistration.address,
      phoneNumber: acceptedRegistration.phoneNumber,
      features: selectedFeatures.map((feature) => feature._id),
      status: "active",
      acceptedBy: superadmin._id,
      credentialsSentAt: new Date(),
    });
  }

  const roles = await ensureOrganizationRoles(organization._id);

  const admin = await User.findOneAndUpdate(
    { email: "admin@accepted-demo.test" },
    {
      $setOnInsert: {
        organization: organization._id,
        name: "Demo Org Admin",
        email: "admin@accepted-demo.test",
        phoneNumber: "+919900002222",
        password: hashedPassword,
        role: roles.admin._id,
        roleName: "admin",
        createdBy: superadmin._id,
        mustChangePassword: false,
      },
    },
    { upsert: true, new: true }
  );

  organization.adminUser = admin._id;
  await organization.save();

  await Promise.all([
    User.findOneAndUpdate(
      { email: "teacher@accepted-demo.test" },
      {
        $setOnInsert: {
          organization: organization._id,
          name: "Demo Teacher",
          email: "teacher@accepted-demo.test",
          phoneNumber: "+919900003333",
          password: hashedPassword,
          role: roles.teacher._id,
          roleName: "teacher",
          createdBy: admin._id,
          mustChangePassword: false,
        },
      },
      { upsert: true, new: true }
    ),
    User.findOneAndUpdate(
      { email: "student@accepted-demo.test" },
      {
        $setOnInsert: {
          organization: organization._id,
          name: "Demo Student",
          email: "student@accepted-demo.test",
          phoneNumber: "+919900004444",
          password: hashedPassword,
          role: roles.student._id,
          roleName: "student",
          createdBy: admin._id,
          mustChangePassword: false,
        },
      },
      { upsert: true, new: true }
    ),
  ]);

  acceptedRegistration.acceptedOrganization = organization._id;
  await acceptedRegistration.save();

  console.log("Dummy data seeded");
  console.log("Login users:");
  console.log(`superadmin@placementdecode.test / ${dummyPassword}`);
  console.log(`admin@accepted-demo.test / ${dummyPassword}`);
  console.log(`teacher@accepted-demo.test / ${dummyPassword}`);
  console.log(`student@accepted-demo.test / ${dummyPassword}`);
  console.log(`Pending registration: ${pendingRegistration.orgEmail}`);

  process.exit(0);
}

seedDummyData().catch((error) => {
  console.error("Dummy seed failed:", error);
  process.exit(1);
});
