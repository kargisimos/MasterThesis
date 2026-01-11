import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Dashboard() {
  const { userRole } = useAuth();
  let userEmail = null;
  const token = localStorage.getItem("access_token");
  if (token) {
      try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          userEmail = payload.sub;
      } catch (e) {
      }
  }

  return (
    <div className="dashboard-card">
        <h1>Dashboard</h1>

        <p style={{ marginBottom: "20px", color: "#374151" }}>
        Welcome back{userEmail ? `, ${userEmail}` : ""}.
        </p>

        <div
        style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
        }}
        >
        {(userRole === "admin" || userRole === "operator") && (
            <div className="dashboard-card">
            <h3>Devices</h3>
            <p>Manage and monitor registered devices.</p>
            <Link to="/devices">Go to Devices →</Link>
            </div>
        )}

        {userRole === "admin" && (
            <div className="dashboard-card">
            <h3>Users</h3>
            <p>Manage system users and roles.</p>
            <Link to="/users">Go to Users →</Link>
            </div>
        )}

        {userRole === "admin" && (
            <div className="dashboard-card">
            <h3>Audit Logs</h3>
            <p>Review system activity and actions.</p>
            <Link to="/auditlogs">View Audit Logs →</Link>
            </div>
        )}

        <div className="dashboard-card">
            <h3>Settings</h3>
            <p>Manage your profile and security settings.</p>
            <Link to="/settings">Go to Settings →</Link>
        </div>
        </div>
    </div>
  );
}
