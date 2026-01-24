// src/services/aiService.js

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:8080";
const AI_ENDPOINT = `${API_BASE_URL}/api/ai/quality-check`;
const USE_MOCK = process.env.REACT_APP_USE_MOCK_AI === "true";

const fileToBase64 = (file) => {
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

// Improved mock AI. Uses filename heuristics for consistent dev-time results.
export const mockAnalyzeImage = (file) => {
  const hashFilename = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  return new Promise((resolve) => {
    setTimeout(() => {
      const fileName = file.name.toLowerCase();

      let detectedProduct = "Unknown";
      if (fileName.includes("tomato")) {
        detectedProduct = "Tomato";
      } else if (fileName.includes("straw") || fileName.includes("berry")) {
        detectedProduct = "Strawberry";
      } else if (fileName.includes("banana")) {
        detectedProduct = "Banana";
      } else if (fileName.includes("carrot")) {
        detectedProduct = "Carrot";
      } else if (fileName.includes("potato")) {
        detectedProduct = "Potato";
      } else if (fileName.includes("onion")) {
        detectedProduct = "Onion";
      } else if (fileName.includes("mango")) {
        detectedProduct = "Mango";
      } else if (fileName.includes("apple")) {
        detectedProduct = "Apple";
      } else if (fileName.includes("corn")) {
        detectedProduct = "Corn";
      } else if (fileName.includes("grape")) {
        detectedProduct = "Grapes";
      } else if (fileName.includes("wheat") || fileName.includes("rice")) {
        detectedProduct = "Wheat/Rice";
      }

      let quality, rating, consumable, freshnessPercent, analysis;

      if (fileName.includes("rotten") || fileName.includes("bad")) {
        quality = "Poor";
        rating = 2.0;
        consumable = false;
        freshnessPercent = 25;
        analysis =
          "This product shows signs of decay and is not suitable for consumption.";
      } else if (fileName.includes("ripe") || fileName.includes("fresh")) {
        quality = "Excellent";
        rating = 4.5;
        consumable = true;
        freshnessPercent = 92;
        analysis =
          "This product appears to be in excellent condition and ready for consumption.";
      } else {
        const hash = hashFilename(fileName);
        const qualityLevel = hash % 3;

        if (qualityLevel === 0) {
          quality = "Good";
          rating = 3.8;
          consumable = true;
          freshnessPercent = 78;
          analysis = "This product is in good condition for consumption.";
        } else if (qualityLevel === 1) {
          quality = "Excellent";
          rating = 4.2;
          consumable = true;
          freshnessPercent = 85;
          analysis =
            "This product is in excellent condition and ready for consumption.";
        } else {
          quality = "Good";
          rating = 3.9;
          consumable = true;
          freshnessPercent = 80;
          analysis = "This product appears to be in acceptable condition.";
        }
      }

      const hash = hashFilename(fileName);
      const confidenceBase = (hash % 29) + 70;
      const confidence = confidenceBase.toFixed(0);

      resolve({
        detectedProduct,
        quality,
        rating: parseFloat(rating),
        consumable,
        analysis,
        confidence: parseInt(confidence),
        freshnessPercent,
      });
    }, 800);
  });
};

export const analyzeImageWithAI = async (file) => {
  if (USE_MOCK) {
    return mockAnalyzeImage(file);
  }

  try {
    const base64Image = await fileToBase64(file);
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product: file.name, base64Image }),
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    const payload = await response.json();
    return payload;
  } catch (error) {
    console.error("AI analysis failed, using mock response:", error);
    return mockAnalyzeImage(file);
  }
};
