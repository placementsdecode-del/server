require("dotenv").config();

const connectDB = require("./config/db");
const Feature = require("./models/Feature");
const User = require("./models/User");
const { ensureRole } = require("./services/rbac.service");

const defaultFeatures = [
  {
    key: "student-management",
    name: "Student Management",
    description: "Create and manage student accounts.",
    enabledByDefault: true,
  },
  {
    key: "teacher-management",
    name: "Teacher Management",
    description: "Create and manage teacher accounts.",
    enabledByDefault: true,
  },
  {
    key: "placement-drives",
    name: "Placement Drives",
    description: "Manage placement drives and related workflows.",
    enabledByDefault: false,
  },
  {
    key: "reports",
    name: "Reports",
    description: "View organization-level placement reports.",
    enabledByDefault: false,
  },
];

async function seed() {
  await connectDB();

  await Promise.all(
    defaultFeatures.map((feature) =>
      Feature.findOneAndUpdate({ key: feature.key }, { $set: feature }, { upsert: true, new: true })
    )
  );

  const [superadminRole] = await Promise.all([
    ensureRole("superadmin", null, true),
    ensureRole("admin", null, true),
    ensureRole("teacher", null, true),
    ensureRole("student", null, true),
  ]);
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required for seeding");
  }

  const existing = await User.findOne({ email: email.toLowerCase() });

  if (!existing) {
    await User.create({
      name: process.env.SUPERADMIN_NAME || "Platform Super Admin",
      email,
      password,
      role: superadminRole._id,
      roleName: "superadmin",
      mustChangePassword: false,
    });
    console.log(`Created superadmin: ${email}`);
  } else {
    console.log(`Superadmin already exists: ${email}`);
  }

  console.log("Seed complete");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
