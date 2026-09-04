function generateTemporaryPassword(email?: string) {
  const username = email?.split("@")[0]?.trim();

  if (username) {
    return `${username}@123`;
  }

  return "user@123";
}

export { generateTemporaryPassword };
