import api from "./api";

const AuthService = {
    login: async (email, password) => {
        const response = await api.post("/auth/login", { email, password });
        return response.data;
    },

    register: async (userData) => {
        const response = await api.post("/auth/register", userData);
        return response.data;
    },

    logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
    },

    forgotPassword: async (email) => {
        const response = await api.post("/auth/forgot-password", { email });
        return response.data;
    },

    resetPassword: async (token, new_password) => {
        const response = await api.post("/auth/reset-password", { token, new_password });
        return response.data;
    },
};

export default AuthService;
