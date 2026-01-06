import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import "./Dashboard.css";

export default function AuditLogs() {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem("access_token");

  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    if (!accessToken) {
      navigate("/");
      return;
    }

    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      setUserRole(payload.role);

      if (payload.role !== "admin") {
        navigate("/dashboard"); // only admins can see logs
        return;
      }
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/");
      return;
    }
  }, [accessToken, navigate]);

  useEffect(() => {
    if (userRole === "admin") {
      fetchLogs(page);
    }
  }, [page, userRole]);

  const fetchLogs = async (pageNumber) => {
    setLoading(true);
    try {
      const res = await api.get("/auditlogs", {
        params: { page: pageNumber, page_size: pageSize },
      });
      setLogs(res.data.logs);
      setTotalPages(res.data.total_pages);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/");
    } finally {
      setLoading(false);
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
          <h1>Audit Logs</h1>

          {loading ? (
            <p>Loading logs...</p>
          ) : logs.length === 0 ? (
            <p>No logs found.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc" }}>Timestamp</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc" }}>Actor</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc" }}>Action</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc" }}>Target</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>{log.actor_email}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>{log.action}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>{log.target_name || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between" }}>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </main>
    </div>
  );
}
