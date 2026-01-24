import axios from "axios";

const baseURL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080";

const axiosInstance = axios.create({
  baseURL,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token =
      (typeof localStorage !== "undefined" && localStorage.getItem("token")) ||
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("authToken"));

    if (token) {
      const sanitizedToken = token.replace(/"/g, "");
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${sanitizedToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status ?? 0;
    const data = error?.response?.data;
    const message = data?.message || error?.message || "Request failed";
    const url = `${error?.config?.baseURL || baseURL}${error?.config?.url || ""}`;

    console.error("[API] Request failed", {
      url,
      status,
      data,
    });

    const normalizedError = {
      status,
      message,
      data,
      url: error?.config?.url || "",
      method: error?.config?.method,
    };

    return Promise.reject(normalizedError);
  },
);

export default axiosInstance;
