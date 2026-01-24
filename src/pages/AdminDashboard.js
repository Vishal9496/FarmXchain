import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API, logoutUser, getAllProducts } from "./api";
import { Users, Package, TrendingUp, Eye, EyeOff, LogOut } from "lucide-react";

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [newRole, setNewRole] = useState("");
  const [showPasswordIds, setShowPasswordIds] = useState([]);
  const [activeTab, setActiveTab] = useState("users");
  const navigate = useNavigate();

  const roles = ["farmer", "distributor", "retailer", "customer"];

  // ✅ Fetch all products from backend
  useEffect(() => {
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const allProducts = await getAllProducts();
        const mappedProducts = allProducts.map((product) => ({
          id: product.id,
          name: product.cropType,
          farmer: `Farmer ID: ${product.farmerId}`,
          status: product.retailerId ? "Active" : "Pending",
          price: 2.5,
          ...product,
        }));
        setProducts(mappedProducts);
      } catch (err) {
        console.error("Failed to fetch products:", err);
        // Fallback to mock data
        setProducts([
          {
            id: 1,
            name: "Organic Tomatoes",
            farmer: "Green Fields Farm",
            status: "Active",
            price: 2.5,
          },
          {
            id: 2,
            name: "Bell Peppers",
            farmer: "Sunshine Acres",
            status: "Active",
            price: 3.0,
          },
          {
            id: 3,
            name: "Carrots",
            farmer: "Riverbend Farm",
            status: "Active",
            price: 1.8,
          },
          {
            id: 4,
            name: "Bananas",
            farmer: "Tropical Farm",
            status: "Inactive",
            price: 2.8,
          },
        ]);
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      const storedUser = JSON.parse(localStorage.getItem("user"));

      const buildMockUsers = () => {
        const current = storedUser || {
          id: "demo-admin",
          name: "Demo Admin",
          email: "admin@demo.local",
          role: "admin",
        };
        return [
          {
            id: current.id,
            name: current.name || "Admin",
            email: current.email,
            role: "admin",
            password: "••••••••",
          },
          {
            id: "u-1",
            name: "Farmer One",
            email: "farmer1@demo.local",
            role: "farmer",
            password: "••••••••",
          },
          {
            id: "u-2",
            name: "Distributor One",
            email: "distributor1@demo.local",
            role: "distributor",
            password: "••••••••",
          },
          {
            id: "u-3",
            name: "Retailer One",
            email: "retailer1@demo.local",
            role: "retailer",
            password: "••••••••",
          },
          {
            id: "u-4",
            name: "Customer One",
            email: "customer1@demo.local",
            role: "customer",
            password: "••••••••",
          },
        ];
      };

      if (!storedUser || storedUser.role.toLowerCase() !== "admin") {
        console.warn(
          "ADMIN CHECK FAILED: User is not logged in or not an Admin."
        );
        alert("Access denied. Admins only.");
        logoutUser();
        navigate("/login");
        return;
      }

      // If this is a demo/offline login (no token), skip backend and use mock data
      if (!storedUser.token) {
        console.info("No token found. Using mock users for offline/demo mode.");
        setUsers(buildMockUsers());
        setLoading(false);
        return;
      }

      try {
        const response = await API.get("/all-with-passwords");
        setUsers(response.data);
      } catch (error) {
        console.error(
          "Admin Fetch Error Details:",
          error.message,
          error.response
        );

        if (error.response) {
          if (error.response.status === 401 || error.response.status === 403) {
            const rejectionMessage =
              error.response.data?.message ||
              (error.response.status === 403
                ? "Forbidden (Token role check failed)"
                : "Unauthorized (Token expired/invalid)");
            alert(`Authorization Failed: ${rejectionMessage}. Logging out.`);
            logoutUser();
            navigate("/login");
          } else if (error.response.status >= 500) {
            setError(
              `Server Error (${error.response.status}): Check your Spring Boot logs.`
            );
          } else {
            setError(
              error.response.data?.message ||
                `HTTP Error ${error.response.status}`
            );
          }
        } else {
          // Network/connection issue: fall back to mock users instead of blocking the UI
          console.warn("Backend unreachable; showing mock users.");
          setUsers(buildMockUsers());
          setError(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [navigate]);

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  const handleDelete = async (userId) => {
    const user = users.find((u) => u.id === userId);
    if (user.role.toLowerCase() === "admin") {
      alert("Admin cannot be deleted");
      return;
    }

    if (!window.confirm("Are you sure?")) return;

    try {
      await API.delete(`/${userId}`);
      setUsers(users.filter((u) => u.id !== userId));
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to delete user.");
    }
  };

  const startEditingRole = (userId, currentRole) => {
    const user = users.find((u) => u.id === userId);
    if (user.role.toLowerCase() === "admin") {
      alert("Admin role cannot be changed");
      return;
    }
    setEditingRoleId(userId);
    setNewRole(currentRole);
  };

  const saveRole = async (userId) => {
    try {
      await API.put(`/${userId}/role`, { role: newRole });
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setEditingRoleId(null);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to update role.");
    }
  };

  const togglePassword = (id) => {
    setShowPasswordIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-lg text-gray-700 font-semibold">
            Loading admin dashboard...
          </p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Users",
      value: users.length,
      icon: Users,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "Products",
      value: products.length,
      icon: Package,
      color: "from-emerald-500 to-green-600",
    },
    {
      label: "Active Listings",
      value: products.filter((p) => p.status === "Active").length,
      icon: TrendingUp,
      color: "from-purple-500 to-pink-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50">
      {/* Header */}
      <header className="backdrop-blur-xl bg-white/80 border-b border-white/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Admin Dashboard 👨‍💼
            </h1>
            <p className="text-gray-600 mt-1">
              System overview and user management
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-6 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-xl transition"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Error Display */}
        {error && (
          <div className="mb-8 backdrop-blur-xl bg-red-50/80 border border-red-200 rounded-2xl p-6 text-red-900">
            <p className="font-semibold">⚠️ Error: {error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="backdrop-blur-xl bg-white/80 border border-white/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-600 font-medium">{stat.label}</p>
                  <div
                    className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center`}
                  >
                    <Icon className="text-white" size={24} />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          {[
            { id: "users", label: "Users", count: users.length },
            { id: "products", label: "Products", count: products.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-semibold transition-all border-b-2 ${
                activeTab === tab.id
                  ? "text-emerald-600 border-emerald-600"
                  : "text-gray-600 border-transparent hover:text-gray-900"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="backdrop-blur-xl bg-white/80 border border-white/50 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Username
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Password
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && !error ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-gray-100 hover:bg-gray-50/50 transition"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {user.username || "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.name || "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.email || "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          {editingRoleId === user.id ? (
                            <select
                              value={newRole}
                              onChange={(e) => setNewRole(e.target.value)}
                              className="px-3 py-1 bg-white/50 border border-gray-200 rounded-lg text-sm"
                            >
                              {roles.map((role) => (
                                <option key={role} value={role}>
                                  {role.charAt(0).toUpperCase() + role.slice(1)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                                user.role?.toLowerCase() === "admin"
                                  ? "bg-red-100 text-red-900"
                                  : user.role?.toLowerCase() === "farmer"
                                  ? "bg-amber-100 text-amber-900"
                                  : user.role?.toLowerCase() === "distributor"
                                  ? "bg-blue-100 text-blue-900"
                                  : user.role?.toLowerCase() === "retailer"
                                  ? "bg-purple-100 text-purple-900"
                                  : "bg-green-100 text-green-900"
                              }`}
                            >
                              {user.role?.charAt(0).toUpperCase() +
                                user.role?.slice(1)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {showPasswordIds.includes(user.id)
                                ? user.password?.substring(0, 8) + "..."
                                : "••••••••"}
                            </code>
                            <button
                              onClick={() => togglePassword(user.id)}
                              className="p-1 hover:bg-gray-100 rounded transition"
                              title="Toggle password visibility"
                            >
                              {showPasswordIds.includes(user.id) ? (
                                <EyeOff size={16} className="text-gray-600" />
                              ) : (
                                <Eye size={16} className="text-gray-600" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {editingRoleId === user.id ? (
                            <button
                              onClick={() => saveRole(user.id)}
                              className="text-sm px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium transition"
                            >
                              Save
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  startEditingRole(user.id, user.role)
                                }
                                disabled={user.role?.toLowerCase() === "admin"}
                                className="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(user.id)}
                                disabled={user.role?.toLowerCase() === "admin"}
                                className="text-sm px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <div className="backdrop-blur-xl bg-white/80 border border-white/50 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Product
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Farmer
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Price
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50 transition"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {product.farmer}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        ${product.price.toFixed(2)}/kg
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            product.status === "Active"
                              ? "bg-green-100 text-green-900"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
