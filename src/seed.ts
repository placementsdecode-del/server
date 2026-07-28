import "dotenv/config";

import connectDB from "./config/db";
import User from "./models/User";
import { ensureDefaultFeatures } from "./services/feature.service";
import { ensureRole } from "./services/rbac.service";

async function seed() {
  await connectDB();

  await ensureDefaultFeatures();

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
