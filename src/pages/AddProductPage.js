import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import {
  ChevronRight,
  ChevronLeft,
  Upload,
  MapPin,
  Calendar,
  Leaf,
  Droplets,
} from "lucide-react";

const AddProductPage = () => {
  const { isDark } = useTheme();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    cropName: "",
    soilType: "",
    pesticides: false,
    harvestDate: "",
    latitude: "",
    longitude: "",
    image: null,
  });
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleImageChange = (e) => {
    setFormData({
      ...formData,
      image: e.target.files[0],
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Save to localStorage
    const products = JSON.parse(localStorage.getItem("products") || "[]");
    const newProduct = {
      id: Date.now(),
      ...formData,
    };
    products.push(newProduct);
    localStorage.setItem("products", JSON.stringify(products));
    navigate("/farmer-dashboard");
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return formData.cropName && formData.soilType;
      case 2:
        return formData.harvestDate;
      case 3:
        return formData.latitude && formData.longitude;
      default:
        return true;
    }
  };

  return (
    <div
      className={`min-h-screen py-12 px-6 transition-colors duration-200 ${
        isDark
          ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"
          : "bg-gradient-to-br from-emerald-50 via-white to-green-50"
      }`}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          {/* Dark mode: white/light gray heading, Light mode: dark gray */}
          <h1
            className={`text-4xl font-bold mb-2 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Add New Crop
          </h1>
          <p className={`${isDark ? "text-slate-300" : "text-gray-600"}`}>
            Step {step} of 4 - Complete the form to add your crop
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((num) => (
              <div
                key={num}
                className={`flex-1 h-2 rounded-full transition-all ${
                  num <= step
                    ? "bg-gradient-to-r from-emerald-500 to-green-600"
                    : isDark
                    ? "bg-slate-600"
                    : "bg-gray-200"
                }`}
              ></div>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <div
          className={`backdrop-blur-xl rounded-3xl shadow-2xl p-8 transition-colors duration-200 ${
            isDark
              ? "bg-slate-800/50 border border-slate-700"
              : "bg-white/80 border border-white/50"
          }`}
        >
          <form onSubmit={handleSubmit}>
            {/* Step 1: Crop Info */}
            {step === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <label
                    className={`block text-sm font-semibold mb-3 ${
                      isDark ? "text-slate-200" : "text-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Leaf className="text-emerald-500" size={20} />
                      Crop Name
                    </div>
                  </label>
                  <input
                    type="text"
                    name="cropName"
                    value={formData.cropName}
                    onChange={handleInputChange}
                    placeholder="e.g., Organic Tomatoes"
                    className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition ${
                      isDark
                        ? "bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400"
                        : "bg-white/50 border border-gray-200 text-gray-900 placeholder-gray-500"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-semibold mb-3 ${
                      isDark ? "text-slate-200" : "text-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Droplets className="text-blue-500" size={20} />
                      Soil Type
                    </div>
                  </label>
                  <select
                    name="soilType"
                    value={formData.soilType}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition ${
                      isDark
                        ? "bg-slate-700/50 border border-slate-600 text-white"
                        : "bg-white/50 border border-gray-200 text-gray-900"
                    }`}
                  >
                    <option value="">Select soil type</option>
                    <option value="Loamy">Loamy</option>
                    <option value="Sandy">Sandy</option>
                    <option value="Clay">Clay</option>
                    <option value="Silt">Silt</option>
                    <option value="Chalky">Chalky</option>
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Pesticides & Harvest */}
            {step === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div
                  className={`backdrop-blur-md rounded-2xl p-6 transition-colors duration-200 ${
                    isDark
                      ? "bg-emerald-900/30 border border-emerald-700/50"
                      : "bg-emerald-50/50 border border-emerald-200"
                  }`}
                >
                  <label className="flex items-center gap-4 cursor-pointer">
                    <input
                      type="checkbox"
                      name="pesticides"
                      checked={formData.pesticides}
                      onChange={handleInputChange}
                      className="w-6 h-6 accent-emerald-500 cursor-pointer"
                    />
                    <div>
                      <p
                        className={`font-semibold ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Pesticides Used
                      </p>
                      <p
                        className={`text-sm ${
                          isDark ? "text-slate-300" : "text-gray-600"
                        }`}
                      >
                        Check if pesticides were applied
                      </p>
                    </div>
                  </label>
                </div>

                <div>
                  <label
                    className={`block text-sm font-semibold mb-3 ${
                      isDark ? "text-slate-200" : "text-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="text-purple-500" size={20} />
                      Expected Harvest Date
                    </div>
                  </label>
                  <input
                    type="date"
                    name="harvestDate"
                    value={formData.harvestDate}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition ${
                      isDark
                        ? "bg-slate-700/50 border border-slate-600 text-white"
                        : "bg-white/50 border border-gray-200 text-gray-900"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Location */}
            {step === 3 && (
              <div className="space-y-6 animate-fadeIn">
                <div
                  className={`backdrop-blur-md rounded-2xl p-6 mb-6 transition-colors duration-200 ${
                    isDark
                      ? "bg-blue-900/30 border border-blue-700/50"
                      : "bg-blue-50/50 border border-blue-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="text-blue-500" size={24} />
                    <div>
                      <p
                        className={`font-semibold ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Farm Location
                      </p>
                      <p
                        className={`text-sm ${
                          isDark ? "text-slate-300" : "text-gray-600"
                        }`}
                      >
                        Enter your farm's GPS coordinates
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    className={`block text-sm font-semibold mb-3 ${
                      isDark ? "text-slate-200" : "text-gray-800"
                    }`}
                  >
                    Latitude
                  </label>
                  <input
                    type="number"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleInputChange}
                    placeholder="e.g., 28.7041"
                    step="0.0001"
                    className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition ${
                      isDark
                        ? "bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400"
                        : "bg-white/50 border border-gray-200 text-gray-900 placeholder-gray-500"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-semibold mb-3 ${
                      isDark ? "text-slate-200" : "text-gray-800"
                    }`}
                  >
                    Longitude
                  </label>
                  <input
                    type="number"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleInputChange}
                    placeholder="e.g., 77.1025"
                    step="0.0001"
                    className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition ${
                      isDark
                        ? "bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400"
                        : "bg-white/50 border border-gray-200 text-gray-900 placeholder-gray-500"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Step 4: Image Upload */}
            {step === 4 && (
              <div className="space-y-6 animate-fadeIn">
                <div
                  className={`backdrop-blur-md rounded-2xl p-8 transition-colors duration-200 ${
                    isDark
                      ? "bg-amber-900/30 border border-amber-700/50"
                      : "bg-amber-50/50 border border-amber-200"
                  }`}
                >
                  <label className="flex flex-col items-center justify-center gap-4 cursor-pointer">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                      <Upload className="text-white" size={32} />
                    </div>
                    <div className="text-center">
                      <p
                        className={`font-semibold ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Upload Crop Image
                      </p>
                      <p
                        className={`text-sm ${
                          isDark ? "text-slate-300" : "text-gray-600"
                        }`}
                      >
                        PNG, JPG up to 10MB
                      </p>
                    </div>
                    <input
                      type="file"
                      name="image"
                      onChange={handleImageChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </label>
                </div>

                {formData.image && (
                  <div
                    className={`backdrop-blur-md rounded-2xl p-4 transition-colors duration-200 ${
                      isDark
                        ? "bg-green-900/30 border border-green-700/50"
                        : "bg-green-50/50 border border-green-200"
                    }`}
                  >
                    <p
                      className={`text-sm font-medium ${
                        isDark ? "text-green-300" : "text-green-900"
                      }`}
                    >
                      ✓ {formData.image.name}
                    </p>
                  </div>
                )}

                <p
                  className={`text-center text-sm pt-4 ${
                    isDark ? "text-slate-300" : "text-gray-600"
                  }`}
                >
                  Image upload is optional. You can upload it later.
                </p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-8">
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                disabled={step === 1}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? "border border-slate-600 text-slate-200 hover:bg-slate-700"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <ChevronLeft size={20} />
                Previous
              </button>

              {step === 4 ? (
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 rounded-xl transition-all duration-200 transform hover:scale-105"
                >
                  Create Crop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={!isStepValid()}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Next
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddProductPage;
