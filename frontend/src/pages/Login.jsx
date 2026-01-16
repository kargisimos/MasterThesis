import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import "./Login.css";
import ReactLogo from "../assets/react.svg";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const savedError = sessionStorage.getItem("login_error");
    if (savedError) {
      setError(savedError);
    }
  }, []);

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
        </form>

        {error && (
          <div
            style={{
              marginTop: "16px",
              padding: "10px",
              borderRadius: "6px",
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
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
