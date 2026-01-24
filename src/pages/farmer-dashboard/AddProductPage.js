import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/addProduct.css";

function AddProductPage({ addProduct }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    cropType: "",
    soilType: "",
    pesticides: "",
    harvestDate: "",
    imageFile: null,
  });

  const [imagePreview, setImagePreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    if (!form.cropType.trim()) newErrors.cropType = "Crop type is required";
    if (!form.soilType.trim()) newErrors.soilType = "Soil type is required";
    if (!form.pesticides.trim())
      newErrors.pesticides = "Pesticides info required";
    if (!form.harvestDate) newErrors.harvestDate = "Harvest date is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));

    if (name === "image" && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result; // base64 persists in localStorage
        setForm({ ...form, imageFile: file });
        setImagePreview(dataUrl);
      };
      reader.readAsDataURL(file);
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const lat = (Math.random() * 180 - 90).toFixed(6);
      const lng = (Math.random() * 360 - 180).toFixed(6);

      const newProduct = {
        id: Date.now().toString(),
        cropType: form.cropType,
        soilType: form.soilType,
        pesticides: form.pesticides,
        harvestDate: form.harvestDate,
        latitude: lat,
        longitude: lng,
        imageUrl: imagePreview, // ✅ use preview URL instead of regenerating
      };

      if (addProduct) {
        addProduct(newProduct);
      }
      navigate("/farmer-dashboard");
    } catch (error) {
      console.error("Failed to save product:", error);
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate("/farmer-dashboard");
  };

  return (
    <div className="add-product-page">
      <div className="form-container">
        <div className="form-header">
          <h1>Add New Product</h1>
          <p>Capture crop details for full traceability.</p>
        </div>

        <div className="form-card">
          <form onSubmit={handleSubmit} className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cropType" className="required">
                  Crop Type
                </label>
                <input
                  type="text"
                  id="cropType"
                  name="cropType"
                  value={form.cropType}
                  onChange={handleChange}
                  className={errors.cropType ? "error" : ""}
                  placeholder="e.g., Organic Rice, Wheat, Corn"
                />
                {errors.cropType && (
                  <span className="error-text">{errors.cropType}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="soilType" className="required">
                  Soil Type
                </label>
                <input
                  type="text"
                  id="soilType"
                  name="soilType"
                  value={form.soilType}
                  onChange={handleChange}
                  className={errors.soilType ? "error" : ""}
                  placeholder="e.g., Black Soil, Loamy Soil"
                />
                {errors.soilType && (
                  <span className="error-text">{errors.soilType}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pesticides" className="required">
                  Pesticides Used
                </label>
                <input
                  type="text"
                  id="pesticides"
                  name="pesticides"
                  value={form.pesticides}
                  onChange={handleChange}
                  className={errors.pesticides ? "error" : ""}
                  placeholder="e.g., Neem Oil, Pyrethroids"
                />
                {errors.pesticides && (
                  <span className="error-text">{errors.pesticides}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="harvestDate" className="required">
                  Harvest Date
                </label>
                <input
                  type="date"
                  id="harvestDate"
                  name="harvestDate"
                  value={form.harvestDate}
                  onChange={handleChange}
                  className={errors.harvestDate ? "error" : ""}
                />
                {errors.harvestDate && (
                  <span className="error-text">{errors.harvestDate}</span>
                )}
              </div>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label htmlFor="image">Upload Image</label>
                <label className="image-upload-area" htmlFor="image">
                  <div className="upload-icon">📷</div>
                  <h3>Click to upload</h3>
                  <p>
                    High-quality field photo helps buyers trust the product.
                  </p>
                </label>
                <input
                  type="file"
                  id="image"
                  name="image"
                  accept="image/*"
                  onChange={handleChange}
                  className="file-input"
                />
                {imagePreview && (
                  <div className="image-preview">
                    <img
                      className="preview-image"
                      src={imagePreview}
                      alt="Preview"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Product"}
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                Back
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddProductPage;
