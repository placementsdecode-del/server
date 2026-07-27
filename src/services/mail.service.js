const nodemailer = require("nodemailer");

function buildTransport() {
  if (!process.env.SMTP_HOST) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });
}

async function sendOrganizationCredentials({ to, orgName, email, password }) {
  const subject = `${process.env.APP_NAME || "Placement Decode"} organization approved`;
  const loginUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const text = [
    `Hello ${orgName},`,
    "",
    "Your organization has been approved.",
    `Admin email: ${email}`,
    `Temporary password: ${password}`,
    `Login: ${loginUrl}`,
    "",
    "Please change this password after first login.",
  ].join("\n");

  const transport = buildTransport();

  if (!transport) {
    console.log("SMTP is not configured. Email preview:");
    console.log({ to, subject, text });
    return { preview: true };
  }

  return transport.sendMail({
    from: process.env.SMTP_FROM || "no-reply@example.com",
    to,
    subject,
    text,
  });
}

module.exports = { sendOrganizationCredentials };
