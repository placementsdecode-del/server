import crypto from "crypto";

function generateTemporaryPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

export { generateTemporaryPassword };
