const crypto = require("crypto");

function generateTemporaryPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

module.exports = { generateTemporaryPassword };
