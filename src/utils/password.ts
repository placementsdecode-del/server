import { randomBytes } from "node:crypto";

function generateTemporaryPassword(_email?: string) {
  return randomBytes(18).toString("base64url");
}

export { generateTemporaryPassword };
