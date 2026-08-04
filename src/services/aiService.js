// src/services/aiService.js

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:8080";
const AI_ENDPOINT = `${API_BASE_URL}/api/ai/quality-check`;

/**
 * ✅ SECURITY (P0-10): mock mode can ONLY be active in a non-production build.
 *
 * `process.env.NODE_ENV` is inlined by Create React App's build step — `npm run build`
 * hard-codes it to `"production"` and CRA does not allow it to be overridden by a `.env`
 * file or a runtime variable. That makes this check unlike every other `REACT_APP_*` flag
 * in this codebase: it cannot be flipped on for a deployed build by setting an environment
 * variable on the hosting platform. `REACT_APP_USE_MOCK_AI=true` on a Netlify/Vercel
 * production deploy is simply ignored — MOCK_MODE_ENABLED is `false` before that value is
 * even read.
 *
 * This is the mechanism, not just the intent: "fabricated AI results must never appear in
 * production" is enforced by the bundler, not by a developer remembering to unset a flag.
 */
const MOCK_MODE_ENABLED = process.env.NODE_ENV !== "production";
const USE_MOCK =
  MOCK_MODE_ENABLED && process.env.REACT_APP_USE_MOCK_AI === "true";

/**
 * ✅ SECURITY (P0-10): every result returned by this module carries a `source` field so the
 * UI can never mistake a simulated result for a real one. `AIQualityCheck.js` renders this
 * as a visible badge.
 */
export const AI_SOURCE = Object.freeze({
  GEMINI: "GEMINI",
  MOCK: "MOCK",
});

/**
 * ✅ SECURITY (P0-10): thrown for every failure — network unreachable, non-2xx response,
 * malformed payload. There is deliberately NO catch path anywhere in this module that
 * returns a fabricated result instead of throwing. See analyzeImageWithAI below.
 */
export class AiAnalysisError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "AiAnalysisError";
    this.cause = cause;
  }
}

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result.split(",")[1];
      resolve(base64String);
    };
    reader.onerror = () =>
      reject(new AiAnalysisError("Could not read the selected image file."));
  });
};

/**
 * Development-only simulated analysis. Filename heuristics produce a stable,
 * reproducible result for a given filename, which is useful for building and
 * testing the UI without spending Gemini quota.
 *
 * ✅ SECURITY (P0-10): this function is not exported for general use — the ONLY
 * caller is analyzeImageWithAI, and only when MOCK_MODE_ENABLED is true, which
 * is itself impossible in a production build (see MOCK_MODE_ENABLED above).
 * Every result is tagged `source: AI_SOURCE.MOCK` so it can never be displayed
 * without the mock badge.
 */
const mockAnalyzeImage = (file) => {
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
        // ✅ P0-10: unambiguous provenance tag — never omitted, never overridable
        // by anything the caller passes in.
        source: AI_SOURCE.MOCK,
      });
    }, 800);
  });
};

/**
 * Calls the real backend AI quality-check endpoint.
 *
 * ✅ SECURITY (P0-10): this function has exactly two outcomes — return a real,
 * server-produced result tagged `source: AI_SOURCE.GEMINI`, or throw
 * `AiAnalysisError`. There is no third outcome where a network failure, a 401,
 * a 500, or a malformed body quietly becomes a plausible-looking invented result.
 */
const callRealAiService = async (file) => {
  let base64Image;
  try {
    base64Image = await fileToBase64(file);
  } catch (err) {
    if (err instanceof AiAnalysisError) throw err;
    throw new AiAnalysisError("Could not read the selected image file.", err);
  }

  let response;
  try {
    response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify({ product: file.name, base64Image }),
    });
  } catch (networkErr) {
    // fetch() rejects only when no HTTP response was received at all:
    // server unreachable, DNS failure, CORS block, or the request timed out.
    throw new AiAnalysisError(
      "Cannot reach the quality-check service. Please check your connection and try again.",
      networkErr,
    );
  }

  if (response.status === 401) {
    throw new AiAnalysisError(
      "Your session has expired. Please sign in again to run a quality check.",
    );
  }
  if (response.status === 403) {
    throw new AiAnalysisError(
      "You do not have permission to run a quality check.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new AiAnalysisError(
      body.message || `Quality check failed (HTTP ${response.status}).`,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (parseErr) {
    throw new AiAnalysisError(
      "The quality-check service returned an unreadable response.",
      parseErr,
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new AiAnalysisError(
      "The quality-check service returned an unexpected response.",
    );
  }

  // ✅ P0-10: tag with the real source. Overwrites anything the server sent in
  // this field, so a caller cannot spoof AI_SOURCE.GEMINI from the network layer.
  return { ...payload, source: AI_SOURCE.GEMINI };
};

/**
 * Public entry point used by AIQualityCheck.js.
 *
 * ✅ SECURITY (P0-10):
 *  - No silent fallback. The removed code was:
 *      catch (error) { console.error(...); return mockAnalyzeImage(file); }
 *    That meant ANY failure of the real service — including one caused by this
 *    very fix (an expired token, a 403 from the P0-5 auth requirement) — was
 *    silently replaced with an invented result with no visible indication
 *    anything had gone wrong. That code path no longer exists anywhere in this
 *    file.
 *  - Mock mode is available ONLY when MOCK_MODE_ENABLED is true, which the
 *    bundler makes impossible in a production build. In production this branch
 *    is unreachable regardless of any environment variable set at deploy time.
 *  - Every return path is tagged with `source`, so the UI can render a badge
 *    without needing to infer provenance from response shape.
 */
export const analyzeImageWithAI = async (file) => {
  if (!file) {
    throw new AiAnalysisError("No image was selected.");
  }

  if (USE_MOCK) {
    // Reachable only in development, with REACT_APP_USE_MOCK_AI=true set locally.
    return mockAnalyzeImage(file);
  }

  return callRealAiService(file);
};
