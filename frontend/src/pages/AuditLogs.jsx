import React, { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

export default function AuditLogs() {
  const { userRole } = useAuth();

  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.actor_email.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      (log.target_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const safeTotalPages = totalPages === 0 ? 1 : totalPages;

  return (
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
  );
}
