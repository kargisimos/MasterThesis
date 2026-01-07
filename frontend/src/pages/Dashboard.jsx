import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem("access_token");

  const [userRole, setUserRole] = useState(null);
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    if (!accessToken) {
      navigate("/");
      return;
    }

    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      setUserRole(payload.role);
      setUserEmail(payload.sub);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/");
    }
  }, [accessToken, navigate]);

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
      </main>
    </div>
  );
}
