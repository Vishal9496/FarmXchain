import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Cloud, Droplets, Wind, Sun, Plus, Edit2, Trash2 } from "lucide-react";
import { getFarmerProducts } from "./api";
import { getAuthenticatedUser } from "../utils/tokenUtils";

const FarmerDashboard = ({ userName }) => {
  const navigate = useNavigate();

  // ✅ State for products from backend
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ Fetch farmer's products on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const user = getAuthenticatedUser();
        if (!user?.id) {
          throw new Error("User not authenticated");
        }

        const farmerId = user.id;
        const farmerProducts = await getFarmerProducts(farmerId);

        // Map backend products to display format
        const mappedProducts = farmerProducts.map((product) => ({
          id: product.id,
          name: product.cropType,
          soil: product.soilType,
          pesticides: product.pesticides === "Organic" ? false : true,
          harvestDate: product.harvestDate,
          image: "🌾", // Default icon
          ...product, // Include all backend fields
        }));

        setProducts(mappedProducts);
      } catch (err) {
        console.error("Failed to fetch products:", err);
        setError(err.message);
        // Fallback to sample data
        setProducts([
          {
            id: 1,
            name: "Organic Tomatoes",
            soil: "Loamy",
            pesticides: false,
            harvestDate: "2025-08-15",
            image: "🍅",
          },
          {
            id: 2,
            name: "Green Peppers",
            soil: "Sandy",
            pesticides: false,
            harvestDate: "2025-08-20",
            image: "🫑",
          },
          {
            id: 3,
            name: "Carrots",
            soil: "Clay",
            pesticides: true,
            harvestDate: "2025-08-25",
            image: "🥕",
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50">
      {/* Header */}
      <header className="backdrop-blur-xl bg-white/80 border-b border-white/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {userName}! 🚜
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your crops and track farm analytics
            </p>
          </div>
          <Link
            to="/add-product"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            <Plus size={20} />
            Add New Crop
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Weather Widget */}
        <div className="mb-12">
          <div className="backdrop-blur-xl bg-gradient-to-br from-blue-400/20 to-cyan-400/20 border border-blue-200/50 rounded-3xl p-8 shadow-xl">
            <div className="flex items-center gap-12">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Current Weather
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="backdrop-blur-md bg-white/60 rounded-2xl p-6 border border-white/50">
                    <div className="flex items-center gap-3 mb-3">
                      <Sun className="text-yellow-500" size={28} />
                      <span className="text-sm text-gray-600">Temperature</span>
                    </div>
                    <p className="text-4xl font-bold text-gray-900">25°C</p>
                  </div>
                  <div className="backdrop-blur-md bg-white/60 rounded-2xl p-6 border border-white/50">
                    <div className="flex items-center gap-3 mb-3">
                      <Droplets className="text-blue-500" size={28} />
                      <span className="text-sm text-gray-600">Humidity</span>
                    </div>
                    <p className="text-4xl font-bold text-gray-900">65%</p>
                  </div>
                  <div className="backdrop-blur-md bg-white/60 rounded-2xl p-6 border border-white/50">
                    <div className="flex items-center gap-3 mb-3">
                      <Wind className="text-teal-500" size={28} />
                      <span className="text-sm text-gray-600">Wind Speed</span>
                    </div>
                    <p className="text-4xl font-bold text-gray-900">12 km/h</p>
                  </div>
                  <div className="backdrop-blur-md bg-white/60 rounded-2xl p-6 border border-white/50">
                    <div className="flex items-center gap-3 mb-3">
                      <Cloud className="text-slate-500" size={28} />
                      <span className="text-sm text-gray-600">Condition</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">Sunny</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Your Crops</h2>

          {/* ✅ Loading state */}
          {loading && (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading your products...</p>
            </div>
          )}

          {/* ✅ Error state */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">
                Could not load products from backend. Showing sample data
                instead.
              </p>
            </div>
          )}

          {/* ✅ Products grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="backdrop-blur-xl bg-white/80 border border-white/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                {/* Product Image Area */}
                <div className="h-40 bg-gradient-to-br from-emerald-200 to-green-300 flex items-center justify-center text-6xl">
                  {product.image}
                </div>

                {/* Product Info */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    {product.name}
                  </h3>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">Soil Type:</span>
                      <span className="inline-block bg-amber-100 text-amber-900 px-3 py-1 rounded-lg text-sm font-medium">
                        {product.soil}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">Pesticides:</span>
                      <span
                        className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${
                          product.pesticides
                            ? "bg-orange-100 text-orange-900"
                            : "bg-green-100 text-green-900"
                        }`}
                      >
                        {product.pesticides ? "Used" : "Organic"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">
                        Harvest Date:
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {product.harvestDate}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEdit(product.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-2 rounded-lg transition-all duration-200"
                    >
                      <Edit2 size={16} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product.id, product.name)}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 rounded-lg transition-all duration-200"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default FarmerDashboard;
