const calculateTotal = (items) => {
  return items.reduce((sum, item) => sum + item.amount, 0);
};

const bcrypt = require("bcrypt");

async function validatePassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

async function fetchFile(fileId) {
  try {
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" },
    );
    return response.data; // File stream
  } catch (error) {
    console.error("Error fetching file:", error.message);
    throw new Error("File not found or access denied.");
  }
}

module.exports = {
  calculateTotal,
  validatePassword,
  fetchFile,
};
