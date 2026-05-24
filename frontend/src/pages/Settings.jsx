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

  const [systemSettings, setSystemSettings] = useState(null);
  const [settingsMessage, setSettingsMessage] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/users/me");
      setProfile(res.data);
      if (res.data.role === "admin") {
          fetchSystemSettings();
      }
    } catch {
      // handled by interceptor
    }
  };

  const fetchSystemSettings = async () => {
      try {
          const res = await api.get("/settings/");
          setSystemSettings(res.data);
      } catch (err) {
          console.error("Failed to fetch system settings", err);
      }
  };

  const saveSystemSettings = async (e) => {
      e.preventDefault();
      setSettingsMessage("");

      if (systemSettings.cpu_warning_threshold >= systemSettings.cpu_critical_threshold) {
          setSettingsMessage("CPU Warning must be less than CPU Critical.");
          setTimeout(() => setSettingsMessage(""), 4000);
          return;
      }
      if (systemSettings.memory_warning_threshold >= systemSettings.memory_critical_threshold) {
          setSettingsMessage("Memory Warning must be less than Memory Critical.");
          setTimeout(() => setSettingsMessage(""), 4000);
          return;
      }

      try {
          const res = await api.patch("/settings/", systemSettings);
          setSystemSettings(res.data);
          setSettingsMessage("System settings saved successfully.");
          setTimeout(() => setSettingsMessage(""), 3000);
      } catch (err) {
          setSettingsMessage("Failed to save settings.");
          setTimeout(() => setSettingsMessage(""), 3000);
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
    } catch (error) {
      if (error.response?.data?.detail) {
        setMessage(error.response.data.detail);
      } else {
        setMessage("Wrong current password or invalid request.");
      }
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

        {profile && profile.role === "admin" && systemSettings && (
            <section style={{ marginBottom: "30px" }}>
                <h2>System Defaults</h2>
                <div style={{ background: "var(--card-bg)", padding: "24px", borderRadius: "10px", border: "1px solid var(--card-border)" }}>
                    <form onSubmit={saveSystemSettings}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "20px" }}>
                            {/* Polling Interval */}
                            <div className="slider-container">
                                <div className="slider-header">
                                    <span className="slider-label">Polling Interval</span>
                                    <span className="slider-value primary">{systemSettings.polling_interval}s</span>
                                </div>
                                <span className="slider-description">Frequency of background host metrics collection.</span>
                                <input 
                                    type="range" 
                                    className="slider-bar"
                                    min="10"
                                    max="300"
                                    step="5"
                                    value={systemSettings.polling_interval} 
                                    onChange={(e) => setSystemSettings({...systemSettings, polling_interval: parseInt(e.target.value)})} 
                                />
                            </div>

                            {/* Latency Warning */}
                            <div className="slider-container">
                                <div className="slider-header">
                                    <span className="slider-label">Latency Warning</span>
                                    <span className="slider-value warning">{systemSettings.latency_warning_threshold} ms</span>
                                </div>
                                <span className="slider-description">Threshold for flagging warning-level host ping latency.</span>
                                <input 
                                    type="range" 
                                    className="slider-bar warning"
                                    min="10"
                                    max="1000"
                                    step="10"
                                    value={systemSettings.latency_warning_threshold} 
                                    onChange={(e) => setSystemSettings({...systemSettings, latency_warning_threshold: parseFloat(e.target.value)})} 
                                />
                            </div>

                            {/* CPU Warning */}
                            <div className="slider-container" style={{
                                borderColor: systemSettings.cpu_warning_threshold >= systemSettings.cpu_critical_threshold ? 'var(--danger)' : 'var(--card-border)'
                            }}>
                                <div className="slider-header">
                                    <span className="slider-label">CPU Warning Threshold</span>
                                    <span className="slider-value warning">{systemSettings.cpu_warning_threshold}%</span>
                                </div>
                                <span className="slider-description">Threshold for CPU usage alerts (warning state).</span>
                                <input 
                                    type="range" 
                                    className="slider-bar warning"
                                    min="10"
                                    max="100"
                                    step="1"
                                    value={systemSettings.cpu_warning_threshold} 
                                    onChange={(e) => setSystemSettings({...systemSettings, cpu_warning_threshold: parseFloat(e.target.value)})} 
                                />
                            </div>

                            {/* CPU Critical */}
                            <div className="slider-container">
                                <div className="slider-header">
                                    <span className="slider-label">CPU Critical Threshold</span>
                                    <span className="slider-value critical">{systemSettings.cpu_critical_threshold}%</span>
                                </div>
                                <span className="slider-description">Threshold for CPU usage critical alerts and system logs.</span>
                                <input 
                                    type="range" 
                                    className="slider-bar critical"
                                    min="10"
                                    max="100"
                                    step="1"
                                    value={systemSettings.cpu_critical_threshold} 
                                    onChange={(e) => setSystemSettings({...systemSettings, cpu_critical_threshold: parseFloat(e.target.value)})} 
                                />
                            </div>

                            {/* Memory Warning */}
                            <div className="slider-container" style={{
                                borderColor: systemSettings.memory_warning_threshold >= systemSettings.memory_critical_threshold ? 'var(--danger)' : 'var(--card-border)'
                            }}>
                                <div className="slider-header">
                                    <span className="slider-label">Memory Warning Threshold</span>
                                    <span className="slider-value warning">{systemSettings.memory_warning_threshold}%</span>
                                </div>
                                <span className="slider-description">Threshold for memory consumption warnings.</span>
                                <input 
                                    type="range" 
                                    className="slider-bar warning"
                                    min="10"
                                    max="100"
                                    step="1"
                                    value={systemSettings.memory_warning_threshold} 
                                    onChange={(e) => setSystemSettings({...systemSettings, memory_warning_threshold: parseFloat(e.target.value)})} 
                                />
                            </div>

                            {/* Memory Critical */}
                            <div className="slider-container">
                                <div className="slider-header">
                                    <span className="slider-label">Memory Critical Threshold</span>
                                    <span className="slider-value critical">{systemSettings.memory_critical_threshold}%</span>
                                </div>
                                <span className="slider-description">Threshold for critical memory consumption and email notifications.</span>
                                <input 
                                    type="range" 
                                    className="slider-bar critical"
                                    min="10"
                                    max="100"
                                    step="1"
                                    value={systemSettings.memory_critical_threshold} 
                                    onChange={(e) => setSystemSettings({...systemSettings, memory_critical_threshold: parseFloat(e.target.value)})} 
                                />
                            </div>
                        </div>

                        {/* Validation Warnings */}
                        {(systemSettings.cpu_warning_threshold >= systemSettings.cpu_critical_threshold || 
                          systemSettings.memory_warning_threshold >= systemSettings.memory_critical_threshold) && (
                            <div style={{ color: "var(--danger)", fontSize: "0.85rem", fontWeight: "600", marginBottom: "15px", display: "flex", gap: "6px", alignItems: "center" }}>
                                <span>⚠️ Warning thresholds must be strictly less than critical thresholds.</span>
                            </div>
                        )}

                        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
                            <button 
                                type="submit" 
                                className="add-device-btn"
                                disabled={
                                    systemSettings.cpu_warning_threshold >= systemSettings.cpu_critical_threshold || 
                                    systemSettings.memory_warning_threshold >= systemSettings.memory_critical_threshold
                                }
                            >
                                Save Settings
                            </button>
                            {settingsMessage && (
                                <span style={{ color: settingsMessage.includes("success") ? "var(--success)" : "var(--danger)", fontSize: "0.9rem", fontWeight: "500" }}>
                                    {settingsMessage}
                                </span>
                            )}
                        </div>
                    </form>
                </div>
            </section>
        )}

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
                <div style={{ marginBottom: "15px" }}>
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={{ width: "100%" }}
                  />
                  <small style={{ color: "var(--text-muted)", fontSize: "0.8rem", display: "block", marginTop: "4px" }}>
                    Must be at least 8 chars, with 1 uppercase, 1 digit, and 1 special character.
                  </small>
                </div>
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
