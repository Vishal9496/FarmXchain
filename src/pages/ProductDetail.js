// src/pages/ProductDetail.js
import { useParams } from "react-router-dom";
import "../styles/ProductDetail.css";

function ProductDetail() {
  const { id } = useParams();
  const products = JSON.parse(localStorage.getItem("products") || "[]");
  const product = products.find((p) => String(p.id) === id);

  if (!product)
    return <div className="product-detail-error">❌ Product not found</div>;

  return (
    <div className="product-detail">
      <div className="product-detail-card">
        {/* Title */}
        <h1>{product.cropType}</h1>

        {/* Image */}
        <div className="product-image">
          {product.image ? (
            <img src={product.image} alt={product.cropType} />
          ) : (
            <div className="no-image">No Image Available</div>
          )}
        </div>

        {/* Info Section */}
        <div className="product-info">
          <div className="info-row">
            <span className="label">Soil Type</span>
            <span className="value">{product.soilType}</span>
          </div>
          <div className="info-row">
            <span className="label">Pesticides</span>
            <span className="value">{product.pesticides}</span>
          </div>
          <div className="info-row">
            <span className="label">Harvest Date</span>
            <span className="value">{product.harvestDate}</span>
          </div>
          <div className="info-row">
            <span className="label">Location</span>
            <span className="value">
              {product.latitude}, {product.longitude}
              <a
                href={`https://www.google.com/maps?q=${product.latitude},${product.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="map-link"
              >
                🌍 View on Map
              </a>
            </span>
          </div>
        </div>

        {/* Verification Badge */}
        <div className="verification-badge">
          ✅ Verified Product - Trusted Source
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
