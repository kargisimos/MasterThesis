import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem("access_token");
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    if (!accessToken) {
      navigate("/");
      return;
    }
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      setUserRole(payload.role);
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
          <h1>Welcome to the Dashboard!</h1>
          <p>Your role: <strong>{userRole}</strong></p>
        </div>
      </main>
    </div>
  );
}
