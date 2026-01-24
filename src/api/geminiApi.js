// Gemini client calls have been moved to the backend to keep API keys off the browser.
// This file remains as a helper for file conversion and to prevent accidental frontend key usage.

/**
 * Converts a File object to a Base64 string for API submission.
 * @param {File} file - The image file selected by the user.
 * @returns {Promise<string>} Base64 data string (without the MIME prefix).
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result.split(",")[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const analyzeImageWithGemini = () => {
  throw new Error(
    "Direct Gemini access from the frontend is disabled. Route calls through the backend proxy."
  );
};
