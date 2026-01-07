import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import "./Dashboard.css";

export default function Settings() {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem("access_token");

  const [profile, setProfile] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  let userRole = null;
  let decodedToken = null;

  if (accessToken) {
    try {
      decodedToken = JSON.parse(atob(accessToken.split(".")[1]));
      userRole = decodedToken.role;
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
      setTimeout(() => setShowPasswordModal(false), 800);
    } catch {
      setMessage("Wrong current password.");
    }
  };

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
          {(userRole === "admin" || userRole === "operator") && (
            <li><Link to="/devices">Devices</Link></li>
          )}
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

          {/* Profile */}
          <section style={{ marginBottom: "30px" }}>
            <h2>Profile</h2>
            {profile ? (
              <table className="data-table">
                <tbody>
                  <tr>
                    <th>Email</th>
                    <td>{profile.email}</td>
                  </tr>
                  <tr>
                    <th>Full Name</th>
                    <td>{profile.full_name}</td>
                  </tr>
                  <tr>
                    <th>Role</th>
                    <td>{profile.role}</td>
                  </tr>
                  <tr>
                    <th>Active</th>
                    <td>{profile.is_active ? "Yes" : "No"}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p>Loading profile...</p>
            )}
          </section>

          {/* Change password button */}
          <section style={{ marginBottom: "30px" }}>
            <h2>Security</h2>
            <button onClick={() => setShowPasswordModal(true)}>
              Change Password
            </button>
          </section>

          {/* System info */}
          <section>
            <h2>System Information</h2>
            <table className="data-table">
              <tbody>
                <tr>
                  <th>Backend Status</th>
                  <td>Online</td>
                </tr>
                <tr>
                  <th>User Role</th>
                  <td>{decodedToken?.role || "-"}</td>
                </tr>
                <tr>
                  <th>Token Expires</th>
                  <td>
                    {decodedToken
                      ? new Date(decodedToken.exp * 1000).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </main>

      {/* Change password modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Change Password</h2>
            <form onSubmit={handleChangePassword}>
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button type="submit">Update</button>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
              >
                Cancel
              </button>
            </form>
            {message && (
              <p
                style={{
                  marginTop: "10px",
                  color: message.includes("success") ? "green" : "red",
                }}
              >
                {message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
