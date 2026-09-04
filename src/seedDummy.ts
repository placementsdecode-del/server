import "dotenv/config";

import bcrypt from "bcryptjs";

import connectDB from "./config/db";
import AcceptedOrganization from "./models/AcceptedOrganization";
import Assessment from "./models/Assessment";
import Feature from "./models/Feature";
import RegisterOrg from "./models/RegisterOrg";
import Section from "./models/Section";
import User from "./models/User";
import { ensureDefaultFeatures } from "./services/feature.service";
import { ensureOrganizationRoles, ensureRole } from "./services/rbac.service";
import { generateTemporaryPassword } from "./utils/password";

async function hashDefaultPassword(email: string) {
  return bcrypt.hash(generateTemporaryPassword(email), 12);
}

async function seedDummyData() {
  await connectDB();

  await ensureDefaultFeatures();

  const superadminRole = await ensureRole("superadmin", null, true);
  const superadmin = await User.findOneAndUpdate(
    { email: "superadmin@gmail.com" },
    {
      $setOnInsert: {
        name: "Dummy Super Admin",
        email: "superadmin@gmail.com",
        password: await hashDefaultPassword("superadmin@gmail.com"),
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
        location: {
          country: "India",
          state: "Karnataka",
          city: "Bengaluru",
          postalCode: "560001",
        },
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
        orgEmail: "admin@gmail.com",
        address: "Demo Tech Park, Pune",
        location: {
          country: "India",
          state: "Maharashtra",
          city: "Pune",
          postalCode: "411001",
        },
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
      location: acceptedRegistration.location,
      phoneNumber: acceptedRegistration.phoneNumber,
      features: selectedFeatures.map((feature) => feature._id),
      status: "active",
      acceptedBy: superadmin._id,
      credentialsSentAt: new Date(),
    });
  }

  const roles = await ensureOrganizationRoles(organization._id);

  const admin = await User.findOneAndUpdate(
    { email: "admin@gmail.com" },
    {
      $setOnInsert: {
        organization: organization._id,
        name: "Demo Org Admin",
        email: "admin@gmail.com",
        phoneNumber: "+919900002222",
        password: await hashDefaultPassword("admin@gmail.com"),
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
      { email: "teacher@gmail.com" },
      {
        $setOnInsert: {
          organization: organization._id,
          name: "Demo Teacher",
          email: "teacher@gmail.com",
          phoneNumber: "+919900003333",
          password: await hashDefaultPassword("teacher@gmail.com"),
          role: roles.teacher._id,
          roleName: "teacher",
          createdBy: admin._id,
          mustChangePassword: false,
        },
      },
      { upsert: true, new: true }
    ),
    User.findOneAndUpdate(
      { email: "student@gmail.com" },
      {
        $setOnInsert: {
          organization: organization._id,
          name: "Demo Student",
          email: "student@gmail.com",
          phoneNumber: "+919900004444",
          password: await hashDefaultPassword("student@gmail.com"),
          role: roles.student._id,
          roleName: "student",
          createdBy: admin._id,
          mustChangePassword: false,
        },
      },
      { upsert: true, new: true }
    ),
  ]);

  const teacher = await User.findOne({ email: "teacher@gmail.com" });
  const student = await User.findOne({ email: "student@gmail.com" });

  const section = await Section.findOneAndUpdate(
    { organization: organization._id, code: "CSE-A-2027" },
    {
      $setOnInsert: {
        organization: organization._id,
        name: "CSE Section A",
        code: "CSE-A-2027",
        department: "Computer Science",
        batch: "2027",
        academicYear: "2026-2027",
        assignedTeachers: teacher ? [teacher._id] : [],
        status: "active",
        description: "Demo section for placement preparation testing.",
      },
    },
    { upsert: true, new: true }
  );

  if (student) {
    student.registrationNumber = "STU-2027-001";
    student.department = "Computer Science";
    student.batch = "2027";
    student.section = section._id;
    student.groups = ["Coding Group"];
    student.preparationScore = 72;
    await student.save();
  }

  await Assessment.findOneAndUpdate(
    { organization: organization._id, title: "Demo Aptitude Assessment" },
    {
      $setOnInsert: {
        organization: organization._id,
        title: "Demo Aptitude Assessment",
        description: "Validated demo assessment for the admin workflow.",
        category: "Aptitude",
        difficulty: "intermediate",
        instructions: "Answer all questions before submitting.",
        durationMinutes: 30,
        totalMarks: 10,
        passingMarks: 4,
        attemptsAllowed: 1,
        assignedSections: [section._id],
        assignedTeachers: teacher ? [teacher._id] : [],
        questions: [
          {
            type: "single-choice",
            text: "If 12 students finish a task in 4 hours, how many student-hours were used?",
            options: ["16", "24", "48", "72"],
            correctAnswer: "48",
            marks: 5,
          },
          {
            type: "true-false",
            text: "Aptitude assessments can be assigned to a section.",
            options: [],
            correctAnswer: true,
            marks: 5,
          },
        ],
        status: "draft",
        createdBy: admin._id,
      },
    },
    { upsert: true, new: true }
  );

  acceptedRegistration.acceptedOrganization = organization._id;
  await acceptedRegistration.save();

  console.log("Dummy data seeded");
  console.log("Login users:");
  console.log(`superadmin@gmail.com / ${generateTemporaryPassword("superadmin@gmail.com")}`);
  console.log(`admin@gmail.com / ${generateTemporaryPassword("admin@gmail.com")}`);
  console.log(`teacher@gmail.com / ${generateTemporaryPassword("teacher@gmail.com")}`);
  console.log(`student@gmail.com / ${generateTemporaryPassword("student@gmail.com")}`);
  console.log(`Pending registration: ${pendingRegistration.orgEmail}`);

  process.exit(0);
}

seedDummyData().catch((error) => {
  console.error("Dummy seed failed:", error);
  process.exit(1);
});
