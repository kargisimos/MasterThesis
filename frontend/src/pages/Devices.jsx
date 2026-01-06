import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import "./Dashboard.css";

const DEVICE_TYPES = ["Router", "Switch", "Server", "IoT Device"];
const PAGE_SIZE = 5;

export default function Devices() {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem("access_token");

  const [devices, setDevices] = useState([]);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [formData, setFormData] = useState({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newDevice, setNewDevice] = useState({
    name: "",
    ip_address: "",
    type: "Router",
    location: "",
    notes: "",
  });

  let userRole = null;

  if (accessToken) {
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      userRole = payload.role;
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/");
    }
  }

  useEffect(() => {
    if (!accessToken) return navigate("/");
    if (userRole === "viewer") return navigate("/dashboard");
    fetchDevices();
  }, [accessToken, userRole, navigate]);

  const fetchDevices = async () => {
    try {
      const res = await api.get("/devices/");
      setDevices(res.data);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/");
    }
  };

  const startEdit = (device) => {
    setEditingDeviceId(device.id);
    setFormData({
      name: device.name,
      ip_address: device.ip_address,
      type: device.type,
      location: device.location || "",
      notes: device.notes || "",
    });
  };

  const cancelEdit = () => {
    setEditingDeviceId(null);
    setFormData({});
  };

  const createDevice = async (e) => {
    e.preventDefault();
    try {
      await api.post("/devices/", newDevice);
      setShowAddForm(false);
      setNewDevice({ name: "", ip_address: "", type: "Router", location: "", notes: "" });
      fetchDevices();
    } catch (err) {
      alert("Failed to create device.");
    }
  };

  const saveEdit = async (deviceId) => {
    try {
      await api.patch(`/devices/${deviceId}`, formData);
      cancelEdit();
      fetchDevices();
    } catch (err) {
      alert("Failed to update device.");
    }
  };

  const deleteDevice = async (device) => {
    if (!window.confirm(`Delete device "${device.name}"?`)) return;
    try {
      await api.delete(`/devices/${device.id}`);
      setDevices(devices.filter((d) => d.id !== device.id));
    } catch (err) {
      alert("Failed to delete device.");
    }
  };

  const filteredDevices = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.ip_address.toLowerCase().includes(search.toLowerCase()) ||
      (d.location && d.location.toLowerCase().includes(search.toLowerCase())) ||
      (d.notes && d.notes.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredDevices.length / PAGE_SIZE);
  const paginatedDevices = filteredDevices.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

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
          <li><button className="logout-button" onClick={handleLogout}>Logout</button></li>
        </ul>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-card">
          <h1>Devices</h1>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ marginBottom: "15px" }}
          >
            {showAddForm ? "Cancel" : "Add Device"}
          </button>

          {showAddForm && (
            <form onSubmit={createDevice} style={{ marginBottom: "20px" }}>
              <input
                placeholder="Device Name *"
                value={newDevice.name}
                onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                required
              />
              <input
                placeholder="IP Address *"
                value={newDevice.ip_address}
                onChange={(e) => setNewDevice({ ...newDevice, ip_address: e.target.value })}
                required
              />
              <select
                value={newDevice.type}
                onChange={(e) => setNewDevice({ ...newDevice, type: e.target.value })}
              >
                {DEVICE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                placeholder="Optional: Location / Department"
                value={newDevice.location}
                onChange={(e) => setNewDevice({ ...newDevice, location: e.target.value })}
              />
              <input
                placeholder="Optional: Notes"
                value={newDevice.notes}
                onChange={(e) => setNewDevice({ ...newDevice, notes: e.target.value })}
              />
              <button type="submit">Create</button>
            </form>
          )}

          <input
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: "15px", width: "100%", padding: "8px" }}
          />

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>IP Address</th>
                <th>Type</th>
                <th>Location / Dept</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDevices.map((device) => (
                <tr key={device.id}>
                  <td>
                    {editingDeviceId === device.id ? (
                      <input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    ) : device.name}
                  </td>
                  <td>
                    {editingDeviceId === device.id ? (
                      <input
                        value={formData.ip_address}
                        onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                      />
                    ) : device.ip_address}
                  </td>
                  <td>
                    {editingDeviceId === device.id ? (
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      >
                        {DEVICE_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    ) : device.type}
                  </td>
                  <td>
                    {editingDeviceId === device.id ? (
                      <input
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Optional"
                      />
                    ) : device.location || "-"}
                  </td>
                  <td>
                    {editingDeviceId === device.id ? (
                      <input
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Optional"
                      />
                    ) : device.notes || "-"}
                  </td>
                  <td>
                    {editingDeviceId === device.id ? (
                      <>
                        <button onClick={() => saveEdit(device.id)}>Save</button>
                        <button onClick={cancelEdit}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(device)}>Edit</button>
                        <button
                          style={{ backgroundColor: "#ef4444", color: "white" }}
                          onClick={() => deleteDevice(device)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span style={{ margin: "0 10px" }}>Page {page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </main>
    </div>
  );
}
