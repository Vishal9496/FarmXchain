import React from "react";
import { ArrowLeft, CheckCircle, Zap, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProductDetailPage = () => {
  const navigate = useNavigate();

  const journey = [
    {
      step: 1,
      name: "Farm",
      company: "Green Fields Farm",
      date: "Aug 15, 2025",
      description: "Harvested fresh organic tomatoes",
      icon: "🌱",
      completed: true,
    },
    {
      step: 2,
      name: "Distributor",
      company: "AgriLogistics Hub",
      date: "Aug 16, 2025",
      description: "Quality checked and packaged",
      icon: "📦",
      completed: true,
    },
    {
      step: 3,
      name: "Retailer",
      company: "FreshMart Store",
      date: "Aug 17, 2025",
      description: "Stored in climate control",
      icon: "🏪",
      completed: true,
    },
    {
      step: 4,
      name: "Your Door",
      company: "Delivery Service",
      date: "Aug 18, 2025",
      description: "Delivered to you",
      icon: "🚚",
      completed: false,
    },
  ];

  const qualityMetrics = [
    { label: "Freshness", value: 95, icon: "✨" },
    { label: "Grade", value: 98, icon: "⭐" },
    { label: "Organic Score", value: 100, icon: "🌿" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50">
      {/* Header */}
      <header className="backdrop-blur-xl bg-white/80 border-b border-white/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft size={24} className="text-gray-900" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Organic Tomatoes
            </h1>
            <p className="text-gray-600 mt-1">Track your produce journey</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Product Info */}
          <div className="lg:col-span-1">
            <div className="backdrop-blur-xl bg-white/80 border border-white/50 rounded-3xl overflow-hidden shadow-xl">
              {/* Product Image */}
              <div className="h-60 bg-gradient-to-br from-red-300 to-orange-400 flex items-center justify-center text-9xl">
                🍅
              </div>

              {/* Product Details */}
              <div className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Organic Tomatoes
                </h2>

                <div className="space-y-4 mb-8">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Price per KG</p>
                    <p className="text-3xl font-bold text-emerald-600">$2.50</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Supplier</p>
                    <p className="font-semibold text-gray-900">
                      Green Fields Farm
                    </p>
                    <p className="text-sm text-gray-600">
                      Located in California
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Harvest Date</p>
                    <p className="font-semibold text-gray-900">
                      August 15, 2025
                    </p>
                  </div>
                </div>

                <button className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 rounded-xl transition-all duration-200 transform hover:scale-105">
                  Add to Cart
                </button>
              </div>
            </div>
          </div>

          {/* Timeline & Quality */}
          <div className="lg:col-span-2 space-y-8">
            {/* Journey Timeline */}
            <div className="backdrop-blur-xl bg-white/80 border border-white/50 rounded-3xl p-8 shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-2">
                <TrendingUp className="text-emerald-600" size={28} />
                Journey Timeline
              </h3>

              <div className="space-y-6">
                {journey.map((item, index) => (
                  <div key={item.step} className="relative">
                    {/* Connector Line */}
                    {index < journey.length - 1 && (
                      <div
                        className={`absolute left-8 top-20 w-1 h-12 ${
                          item.completed ? "bg-emerald-500" : "bg-gray-200"
                        }`}
                      ></div>
                    )}

                    {/* Timeline Item */}
                    <div className="flex gap-6">
                      {/* Icon Circle */}
                      <div className="relative z-10 flex-shrink-0">
                        <div
                          className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl border-4 ${
                            item.completed
                              ? "bg-gradient-to-br from-emerald-400 to-green-600 border-emerald-600"
                              : "bg-gray-200 border-gray-300"
                          }`}
                        >
                          {item.icon}
                        </div>
                        {item.completed && (
                          <CheckCircle
                            className="absolute -top-1 -right-1 text-emerald-600 bg-white rounded-full"
                            size={24}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-2">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-xl font-bold text-gray-900">
                            {item.name}
                          </h4>
                          {item.completed && (
                            <span className="bg-green-100 text-green-900 px-3 py-1 rounded-full text-xs font-bold">
                              Completed
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 font-medium mb-1">
                          {item.company}
                        </p>
                        <p className="text-sm text-gray-600 mb-2">
                          {item.description}
                        </p>
                        <p className="text-xs text-gray-500">{item.date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Quality Check */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-blue-400/10 to-cyan-400/10 border border-blue-200/50 rounded-3xl p-8 shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-2">
                <Zap className="text-blue-600" size={28} />
                AI Quality Assessment
              </h3>

              <div className="space-y-6">
                {qualityMetrics.map((metric, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">{metric.icon}</span>
                        <span className="font-semibold text-gray-900">
                          {metric.label}
                        </span>
                      </div>
                      <span className="text-2xl font-bold text-blue-600">
                        {metric.value}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-600 transition-all duration-500"
                        style={{ width: `${metric.value}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-6 bg-white/60 rounded-2xl border border-white/50">
                <p className="text-sm text-gray-700">
                  <span className="font-bold text-gray-900">
                    ✓ Premium Grade A
                  </span>{" "}
                  - These tomatoes meet all organic certification standards and
                  have been verified for freshness, pesticide-free status, and
                  nutritional value.
                </p>
              </div>
            </div>

            {/* Certification Badges */}
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  icon: "🌿",
                  label: "100% Organic",
                  desc: "Certified organic",
                },
                { icon: "✓", label: "Traceable", desc: "Full farm-to-table" },
                { icon: "🧪", label: "Lab Tested", desc: "Quality verified" },
              ].map((badge, idx) => (
                <div
                  key={idx}
                  className="backdrop-blur-xl bg-white/80 border border-white/50 rounded-2xl p-6 text-center shadow-lg hover:shadow-xl transition"
                >
                  <p className="text-4xl mb-3">{badge.icon}</p>
                  <p className="font-bold text-gray-900 text-sm mb-1">
                    {badge.label}
                  </p>
                  <p className="text-xs text-gray-600">{badge.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProductDetailPage;
