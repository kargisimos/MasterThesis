import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import "./Login.css";
import ReactLogo from "../assets/react.svg";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const savedError = sessionStorage.getItem("login_error");
    if (savedError) {
      setError(savedError);
    }
  }, []);

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setIsForgotLoading(true);
    setForgotMessage("");
    try {
      await AuthService.forgotPassword(forgotEmail);
      setForgotMessage("Success! Check your email for a reset link.");
    } catch (err) {
      setForgotMessage("If an account exists, a reset link has been sent.");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    sessionStorage.removeItem("login_error");

    try {
      const data = await AuthService.login(email, password);
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      sessionStorage.removeItem("login_error");
      navigate("/dashboard");
    } catch (err) {
      const msg = err.response?.data?.detail || "Invalid username or password.";
      setError(msg);
      sessionStorage.setItem("login_error", msg);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src={ReactLogo} alt="Logo" className="login-logo" />

        <h2 className="login-title">
          Network Device Monitoring and Management System
        </h2>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">Login</button>
          
          <div style={{ textAlign: "center", marginTop: "12px" }}>
            <button 
              type="button" 
              className="forgot-password-link" 
              onClick={() => setShowForgotModal(true)}
              style={{ background: "none", color: "var(--primary)", fontSize: "0.85rem", padding: 0 }}
            >
              Forgot Password?
            </button>
          </div>
        </form>

        {showForgotModal && (
          <div className="modal-overlay" onClick={() => setShowForgotModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
              <h2>Reset Password</h2>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <form onSubmit={handleForgotSubmit}>
                <input
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button type="submit" disabled={isForgotLoading}>
                    {isForgotLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                  <button type="button" onClick={() => setShowForgotModal(false)} style={{ background: "var(--bg-muted)", color: "var(--text-main)" }}>
                    Cancel
                  </button>
                </div>
              </form>
              {forgotMessage && (
                <div style={{ marginTop: "12px", color: "var(--success)", fontSize: "0.85rem", fontWeight: "500" }}>
                  {forgotMessage}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "16px",
              padding: "10px",
              borderRadius: "6px",
              backgroundColor: "var(--danger-muted)",
              color: "var(--danger-text)",
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
