import React, { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

export default function Settings() {
  const { userRole } = useAuth();
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
        <h2>Security</h2>
        <button onClick={() => setShowPasswordModal(true)}>
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
