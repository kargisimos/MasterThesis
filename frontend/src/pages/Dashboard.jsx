import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  let userRole = null;

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userRole = payload.role;
    } catch (e) {
      localStorage.removeItem("token");
      navigate("/");
    }
  }

  useEffect(() => {
    if (!token) {
      navigate("/");
    }
  }, [token, navigate]);

  return (
    <div className="dashboard-container">
      <aside className="dashboard-sidebar">
        <h2 className="dashboard-logo">Network Device Monitoring System</h2>
        <ul className="dashboard-menu">
          <li><a href="/dashboard">Dashboard</a></li>
          {userRole === "admin" && <li><a href="/users">Users</a></li>}
          <li><a href="/settings">Settings</a></li>
          <li>
            <button
              className="logout-button"
              onClick={() => {
                localStorage.removeItem("token");
                navigate("/");
              }}
            >
              Logout
            </button>
          </li>
        </ul>
      </aside>
      <main className="dashboard-main">
        <div className="dashboard-card">
          <h1>Welcome to the Dashboard!</h1>
          <p>Your role: <strong>{userRole}</strong></p>
        </div>
      </main>
    </div>
  );
}
