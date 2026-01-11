import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AuthService from "../services/authService";

export const useAuth = () => {
    const [userRole, setUserRole] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        checkAuth();
    }, [location.pathname]);

    const checkAuth = () => {
        const token = localStorage.getItem("access_token");
        if (!token) {
            setUserRole(null);
            setIsAuthenticated(false);
            setIsLoading(false);
            if (location.pathname !== "/") {
                navigate("/");
            }
            return;
        }

        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            setUserRole(payload.role);
            setIsAuthenticated(true);
        } catch (e) {
            AuthService.logout();
            setUserRole(null);
            setIsAuthenticated(false);
            navigate("/");
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        AuthService.logout();
        navigate("/");
    };

    return { userRole, isAuthenticated, isLoading, logout };
};
