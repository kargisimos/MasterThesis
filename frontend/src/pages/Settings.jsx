import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import "./Dashboard.css";

export default function Settings() {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem("access_token");

  const [profile, setProfile] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  let userRole = null;

  if (accessToken) {
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      userRole = payload.role;
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/");
    }
  }

  useEffect(() => {
    if (!accessToken) {
      navigate("/");
      return;
    }
    fetchProfile();
  }, [accessToken, navigate]);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/users/me");
      setProfile(res.data);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setMessage("Wrong current password.");
    }
  };

  const decodedToken = accessToken
    ? JSON.parse(atob(accessToken.split(".")[1]))
    : null;

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/");
  };

  return (
    <div className="dashboard-container">
      <aside className="dashboard-sidebar">
        <h2 className="dashboard-logo">Network Device Monitoring System</h2>
        <ul className="dashboard-menu">
          <li><Link to="/dashboard">Dashboard</Link></li>
          {userRole === "admin" || userRole === "operator" ? (<li><Link to="/devices">Devices</Link></li>) : null}
          {userRole === "admin" && <li><Link to="/users">Users</Link></li>}
          {userRole === "admin" && <li><Link to="/auditlogs">Audit Logs</Link></li>}
          <li><Link to="/settings">Settings</Link></li>
          <li>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </li>
        </ul>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-card">
          <h1>Settings</h1>

          <section style={{ marginBottom: "30px" }}>
            <h2>Profile</h2>
            {profile && (
              <ul>
                <li><strong>Email:</strong> {profile.email}</li>
                <li><strong>Full Name:</strong> {profile.full_name}</li>
                <li><strong>Role:</strong> {profile.role}</li>
                <li><strong>Active:</strong> {profile.is_active ? "Yes" : "No"}</li>
              </ul>
            )}
          </section>

          <section style={{ marginBottom: "30px" }}>
            <h2>Change Password</h2>
            <form onSubmit={handleChangePassword}>
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                style={{ display: "block", marginBottom: "10px", width: "100%", padding: "8px" }}
              />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{ display: "block", marginBottom: "10px", width: "100%", padding: "8px" }}
              />
              <button type="submit">Update Password</button>
            </form>
            {message && <p style={{ marginTop: "10px" }}>{message}</p>}
          </section>

          <section>
            <h2>System Information</h2>
            <ul>
              <li><strong>Backend status:</strong> Online</li>
              <li><strong>User role:</strong> {decodedToken?.role}</li>
              <li>
                <strong>Token expires:</strong>{" "}
                {decodedToken
                  ? new Date(decodedToken.exp * 1000).toLocaleString()
                  : "-"}
              </li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
