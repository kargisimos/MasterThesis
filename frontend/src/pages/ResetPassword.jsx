import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import AuthService from "../services/authService";
import "./Login.css";

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
    const token = searchParams.get("token");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setError("");
        setIsLoading(true);
        try {
            await AuthService.resetPassword(token, password);
            setMessage("Password reset successful! Redirecting to login...");
            setTimeout(() => navigate("/"), 3000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to reset password. The link may have expired.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <h2 className="login-title">Invalid Link</h2>
                    <p style={{ textAlign: "center", color: "var(--text-muted)" }}>This reset link is invalid or has expired.</p>
                    <Link to="/" style={{ display: "block", textAlign: "center", marginTop: "20px", color: "var(--primary)" }}>Back to Login</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <h2 className="login-title">Set New Password</h2>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "20px", textAlign: "center" }}>
                    Enter your new password below.
                </p>
                
                <form className="login-form" onSubmit={handleSubmit}>
                    <input
                        type="password"
                        placeholder="New Password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Confirm New Password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? "Updating..." : "Reset Password"}
                    </button>
                </form>

                {error && (
                    <div style={{ marginTop: "16px", padding: "10px", borderRadius: "6px", backgroundColor: "var(--danger-muted)", color: "var(--danger-text)", textAlign: "center" }}>
                        {error}
                    </div>
                )}
                
                {message && (
                    <div style={{ marginTop: "16px", padding: "10px", borderRadius: "6px", backgroundColor: "var(--success-muted)", color: "var(--success-text)", textAlign: "center" }}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
}
