import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../../styles/editProduct.css";

function EditProductPage({ products, setProducts }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const productToEdit = products.find((p) => p.id.toString() === id);

  const [form, setForm] = useState({
    cropType: "",
    soilType: "",
    pesticides: "",
    harvestDate: "",
    imageFile: null,
    imageUrl: "",
  });

  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    if (productToEdit) {
      setForm({
        cropType: productToEdit.cropType,
        soilType: productToEdit.soilType,
        pesticides: productToEdit.pesticides,
        harvestDate: productToEdit.harvestDate,
        imageFile: null,
        imageUrl: productToEdit.imageUrl,
      });
      setImagePreview(productToEdit.imageUrl);
    }
  }, [productToEdit]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "image" && files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
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

    // Get user and token from localStorage
    const user = JSON.parse(localStorage.getItem("user"));
    const token = user?.token;

    // Update product locally (works without backend)
    const updatedProduct = {
      ...productToEdit,
      cropType: form.cropType,
      soilType: form.soilType,
      pesticides: form.pesticides,
      harvestDate: form.harvestDate,
      imageUrl: imagePreview || form.imageUrl,
    };

    // Update in state and localStorage
    const updatedProducts = products.map((p) =>
      p.id.toString() === id ? updatedProduct : p
    );
    setProducts(updatedProducts);
    localStorage.setItem("products", JSON.stringify(updatedProducts));

    // Try to sync with backend if available
    if (token) {
      const formData = new FormData();
      formData.append("cropType", form.cropType);
      formData.append("soilType", form.soilType);
      formData.append("pesticides", form.pesticides);
      formData.append("harvestDate", form.harvestDate);
      if (form.imageFile) formData.append("image", form.imageFile);

      try {
        const res = await fetch(
          `http://localhost:8080/api/products/edit/${id}`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          }
        );

        if (!res.ok) {
          console.warn("Backend update failed, but local update succeeded");
        }
      } catch (err) {
        console.warn(
          "Backend not available, using local storage only:",
          err.message
        );
      }
    }

    alert("Product updated successfully!");
    navigate("/farmer-dashboard");
  };

  if (!productToEdit)
    return <div className="add-container">Product not found.</div>;

  return (
    <div className="edit-product-page">
      <div className="form-container">
        <div className="form-header">
          <h1>Edit Product</h1>
          <p>Update your crop details and image.</p>
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
                />
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
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pesticides" className="required">
                  Pesticides
                </label>
                <input
                  type="text"
                  id="pesticides"
                  name="pesticides"
                  value={form.pesticides}
                  onChange={handleChange}
                />
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
                />
              </div>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label htmlFor="image">Upload Image</label>
                <label className="image-upload-area" htmlFor="image">
                  <div className="upload-icon">📷</div>
                  <h3>Click to upload</h3>
                  <p>Add a clear product photo to build trust.</p>
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
              <button type="submit" className="btn-submit">
                Save Changes
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => navigate("/farmer-dashboard")}
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

export default EditProductPage;
