import "dotenv/config";

import connectDB from "./config/db";
import RegisterOrg from "./models/RegisterOrg";
import User from "./models/User";
import { ensureDefaultFeatures } from "./services/feature.service";
import { ensureRole } from "./services/rbac.service";
import { generateTemporaryPassword } from "./utils/password";

async function seed() {
  await connectDB();

  await ensureDefaultFeatures();

  const [superadminRole] = await Promise.all([
    ensureRole("superadmin", null, true),
    ensureRole("admin", null, true),
    ensureRole("teacher", null, true),
    ensureRole("student", null, true),
  ]);
  const email = process.env.SUPERADMIN_EMAIL || "superadmin@gmail.com";
  const password = process.env.SUPERADMIN_PASSWORD || generateTemporaryPassword(email);

  let superadmin: any = await User.findOne({ email: email.toLowerCase() }).select("+password");

  if (!superadmin) {
    superadmin = new User({ email });
  }

  superadmin.name = process.env.SUPERADMIN_NAME || "Platform Super Admin";
  superadmin.password = password;
  superadmin.role = superadminRole._id;
  superadmin.roleName = "superadmin";
  superadmin.mustChangePassword = false;
  superadmin.status = "active";
  await superadmin.save();

  await RegisterOrg.findOneAndUpdate(
    { orgEmail: "admin@gmail.com" },
    {
      $setOnInsert: {
        orgName: "Dev Test Organization",
        orgEmail: "admin@gmail.com",
        address: "Dev Campus, Bengaluru",
        location: {
          country: "India",
          state: "Karnataka",
          city: "Bengaluru",
          postalCode: "560001",
        },
        phoneNumber: "+919900002222",
        status: "pending",
        discussionNotes: "Created by seed for superadmin approval testing.",
        reviewedBy: superadmin._id,
      },
    },
    { upsert: true, new: true }
  );

  console.log("Seed complete");
  console.log(`Superadmin: ${email} / ${password}`);
  console.log("Pending organization: Dev Test Organization / admin@gmail.com");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
