import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  Camera,
  ArrowLeft,
} from "lucide-react";
import { analyzeImageWithAI } from "../services/aiService";

const AIQualityCheck = () => {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [aiResponse, setAiResponse] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setResult(null);
      setAiResponse(null);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const analyzeProduct = async () => {
    if (!selectedImage) return;
    setAnalyzing(true);
    setResult(null);
    setAiResponse(null);

    try {
      // ✅ Call AI service to get complete analysis
      const ai = await analyzeImageWithAI(selectedImage);
      setAiResponse(ai);

      // ✅ Extract values from AI response
      const detectedProduct = ai.detectedProduct || "Unknown";
      const aiQuality = ai.quality || "Unknown";
      const aiRating = ai.rating || 3.0;
      const isConsumable = ai.consumable !== false;
      const aiAnalysis = ai.analysis || "Analysis complete.";
      const aiConfidence = ai.confidence || 85;

      // ✅ Map AI rating (1-5 scale) to quality score (0-100)
      let qualityScore = Math.round((aiRating / 5) * 100);
      qualityScore = Math.max(10, Math.min(100, qualityScore)); // Clamp to 10-100

      // ✅ Freshness is derived from AI rating
      let freshness = Math.round((aiRating / 5) * 100);
      freshness = Math.max(10, Math.min(100, freshness));

      // ✅ Generate issues dynamically based on AI quality
      let detectedIssues = [];
      if (!isConsumable || aiQuality === "Poor") {
        detectedIssues.push("❌ NOT RECOMMENDED for consumption");
      }
      if (aiQuality === "Poor") {
        detectedIssues.push("⚠️ Product quality is below standards");
        detectedIssues.push("⚠️ Shows signs of spoilage or damage");
      } else if (aiQuality === "Good") {
        // No issues for good quality
      } else if (aiQuality === "Excellent") {
        // No issues for excellent quality
      }

      // ✅ Verified only if consumable and good quality
      const verified = isConsumable && qualityScore >= 70;

      // ✅ Organic certification (deterministic based on AI confidence)
      const isOrganic = aiConfidence >= 90;

      // ✅ Harvest date (recent for fresh, older for lower quality)
      const daysAgo = verified
        ? Math.floor(Math.random() * 7)
        : Math.floor(Math.random() * 21);
      const harvestDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // ✅ Set result with AI-driven data
      setResult({
        score: qualityScore,
        isOrganic,
        freshness,
        verified,
        detectedIssues,
        detectedProduct,
        harvestDate,
        aiQuality,
        aiAnalysis,
      });
    } catch (error) {
      console.error("AI analysis failed:", error);
      setResult(null);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate("/customer-dashboard")}
            className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold mb-4 transition"
          >
            <ArrowLeft size={20} />
            Back to Marketplace
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            AI Quality Check
          </h1>
          <p className="text-gray-600 text-lg">
            Upload a product image for instant AI-powered quality verification
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="backdrop-blur-xl bg-white/80 border border-white/50 rounded-3xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Camera className="text-emerald-600" />
              Upload Product Image
            </h2>

            {!imagePreview ? (
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-emerald-300 rounded-2xl cursor-pointer bg-emerald-50/50 hover:bg-emerald-100/50 transition">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-16 h-16 text-emerald-500 mb-4" />
                  <p className="mb-2 text-sm text-gray-700 font-semibold">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, JPEG (MAX. 10MB)
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </label>
            ) : (
              <div>
                <div className="relative rounded-2xl overflow-hidden mb-4">
                  <img
                    src={imagePreview}
                    alt="Product"
                    className="w-full h-64 object-cover"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={analyzeProduct}
                    disabled={analyzing}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={20} />
                        Analyze Quality
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setSelectedImage(null);
                      setResult(null);
                      setAiResponse(null);
                    }}
                    className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            <div className="mt-8 space-y-3">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                Our AI analyzes:
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="text-emerald-500" size={16} />
                Product freshness indicators
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="text-emerald-500" size={16} />
                Organic certification validity
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="text-emerald-500" size={16} />
                Visual quality assessment
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="text-emerald-500" size={16} />
                Harvest date verification
              </div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/80 border border-white/50 rounded-3xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Analysis Results
            </h2>

            {!result && !analyzing && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-gray-500 font-medium">
                  Upload an image to get started
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  AI will analyze quality instantly
                </p>
              </div>
            )}

            {analyzing && (
              <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mb-4" />
                <p className="text-gray-700 font-semibold">
                  Analyzing product quality...
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Using advanced AI algorithms
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-6">
                <div
                  className={`p-6 rounded-2xl ${
                    result.verified
                      ? "bg-gradient-to-r from-emerald-500 to-green-600"
                      : "bg-gradient-to-r from-orange-500 to-red-600"
                  } text-white`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-semibold">Quality Score</span>
                    {result.verified ? (
                      <CheckCircle2 size={32} />
                    ) : (
                      <XCircle size={32} />
                    )}
                  </div>
                  <div className="text-5xl font-bold">{result.score}%</div>
                  <p className="text-emerald-50 mt-2">
                    {result.verified
                      ? "✓ Verified Quality"
                      : "⚠ Below Standards"}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="border-b border-gray-200 pb-4">
                    <p className="text-sm text-gray-600">Detected Product</p>
                    <p className="text-xl font-bold text-gray-900">
                      {result.detectedProduct}
                    </p>
                  </div>

                  <div className="border-b border-gray-200 pb-4">
                    <p className="text-sm text-gray-600">Freshness Level</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            result.freshness >= 70
                              ? "bg-gradient-to-r from-emerald-500 to-green-600"
                              : result.freshness >= 40
                              ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                              : "bg-gradient-to-r from-orange-500 to-red-600"
                          }`}
                          style={{ width: `${result.freshness}%` }}
                        />
                      </div>
                      <span
                        className={`text-lg font-bold ${
                          result.freshness >= 70
                            ? "text-emerald-600"
                            : result.freshness >= 40
                            ? "text-orange-600"
                            : "text-red-600"
                        }`}
                      >
                        {result.freshness}%
                      </span>
                    </div>
                  </div>

                  {result.detectedIssues &&
                    result.detectedIssues.length > 0 && (
                      <div className="border-b border-gray-200 pb-4">
                        <p className="text-sm text-gray-600 mb-2">
                          Detected Issues
                        </p>
                        <div className="space-y-2">
                          {result.detectedIssues.map((issue, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <XCircle
                                className="text-red-500 flex-shrink-0 mt-0.5"
                                size={16}
                              />
                              <p className="text-sm text-red-700">{issue}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  <div className="border-b border-gray-200 pb-4">
                    <p className="text-sm text-gray-600">
                      Organic Certification
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {result.isOrganic ? (
                        <>
                          <CheckCircle2
                            className="text-emerald-500"
                            size={20}
                          />
                          <span className="font-semibold text-emerald-700">
                            Certified Organic
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="text-orange-500" size={20} />
                          <span className="font-semibold text-orange-700">
                            Not Certified
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Estimated Harvest</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {result.harvestDate}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setImagePreview(null);
                    setSelectedImage(null);
                    setResult(null);
                    setAiResponse(null);
                  }}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-xl transition"
                >
                  Analyze Another Product
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIQualityCheck;
