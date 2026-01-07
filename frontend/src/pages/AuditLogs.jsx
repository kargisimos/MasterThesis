import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import "./Dashboard.css";

export default function AuditLogs() {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem("access_token");

  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
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
        navigate("/dashboard");
        return;
      }
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/");
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
      setTotalPages(res.data.total_pages || 1);
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

  const filteredLogs = logs.filter(
    (log) =>
      log.actor_email.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      (log.target_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const safeTotalPages = totalPages === 0 ? 1 : totalPages;

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
          <h1>Audit Logs</h1>

          <input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: "15px", width: "100%", padding: "8px" }}
          />

          {loading ? (
            <p>Loading logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p>No logs found.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>{log.actor_email}</td>
                    <td>{log.action}</td>
                    <td>{log.target_name || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div
            style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Prev
            </button>
            <span>
              Page {page} / {safeTotalPages}
            </span>
            <button
              disabled={page >= safeTotalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
