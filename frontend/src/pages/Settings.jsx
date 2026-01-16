import React, { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";

export default function Settings() {
  const { userRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  let decodedToken = null;
  const accessToken = localStorage.getItem("access_token");
  if (accessToken) {
      try {
          decodedToken = JSON.parse(atob(accessToken.split(".")[1]));
      } catch (e) { }
  }

  const [profile, setProfile] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/users/me");
      setProfile(res.data);
    } catch {
      // handled by interceptor
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

  return (
    <div className="dashboard-card">
        <h1>Settings</h1>

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

        <section style={{ marginBottom: "30px" }}>
        <h2>Interface</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--bg-color)", padding: "15px", borderRadius: "10px", border: "1px solid var(--card-border)" }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "600", marginBottom: "4px" }}>Dark Mode</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Switch between light and dark themes</div>
            </div>
            <label className="switch">
                <input 
                    type="checkbox" 
                    checked={theme === "dark"} 
                    onChange={toggleTheme}
                />
                <span className="slider round"></span>
            </label>
        </div>
        </section>

        <section style={{ marginBottom: "30px" }}>
        <h2>Notifications</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--bg-color)", padding: "15px", borderRadius: "10px", border: "1px solid var(--card-border)" }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "600", marginBottom: "4px" }}>Critical Alerts via Email</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Receive email for host downtime, auth failures, and critical load (&gt;90%)</div>
            </div>
            <label className="switch">
                <input 
                    type="checkbox" 
                    checked={profile?.receive_email_notifications || false} 
                    onChange={async (e) => {
                        const val = e.target.checked;
                        try {
                            await api.patch(`/users/${profile.id}`, { receive_email_notifications: val });
                            setProfile({ ...profile, receive_email_notifications: val });
                        } catch (err) {
                            console.error("Failed to update notification settings", err);
                        }
                    }}
                />
                <span className="slider round"></span>
            </label>
        </div>
        </section>

        <section style={{ marginBottom: "30px" }}>
        <h2>Security</h2>
        <button className="add-device-btn" onClick={() => setShowPasswordModal(true)}>
            Change Password
        </button>
        </section>

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
                    color: message.includes("success") ? "var(--success)" : "var(--danger)",
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
