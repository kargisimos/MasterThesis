import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import "./Login.css";
import ReactLogo from "../assets/react.svg";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.access_token);
      setMessage("Login successful!");

      navigate("/dashboard");
    } catch (err) {
      setMessage("Invalid username or password.");
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
        {message && <p className="login-message">{message}</p>}
      </div>
    </div>
  );
}
