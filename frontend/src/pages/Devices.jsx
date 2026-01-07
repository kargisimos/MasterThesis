import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import "./Dashboard.css";

const DEVICE_TYPES = ["Router", "Switch", "Server", "IoT Device"];
const PAGE_SIZE = 10;

export default function Devices() {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem("access_token");

  const [devices, setDevices] = useState([]);
  const [editingDevice, setEditingDevice] = useState(null);
  const [credentialsDevice, setCredentialsDevice] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDevice, setNewDevice] = useState({
    name: "",
    ip_address: "",
    type: "Router",
    location: "",
    notes: "",
  });

  const [credType, setCredType] = useState("ssh");
  const [credData, setCredData] = useState({
    username: "",
    password: "",
    community_string: "",
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
      setPage(1);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/");
    }
  };

  const createDevice = async (e) => {
    e.preventDefault();
    try {
      await api.post("/devices/", newDevice);
      setShowAddModal(false);
      setNewDevice({ name: "", ip_address: "", type: "Router", location: "", notes: "" });
      fetchDevices();
    } catch {
      alert("Failed to create device.");
    }
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/devices/${editingDevice.id}`, editingDevice);
      setEditingDevice(null);
      fetchDevices();
    } catch {
      alert("Failed to update device.");
    }
  };

  const deleteDevice = async (device) => {
    if (!window.confirm(`Delete device "${device.name}"?`)) return;
    try {
      await api.delete(`/devices/${device.id}`);
      setDevices(devices.filter((d) => d.id !== device.id));
    } catch {
      alert("Failed to delete device.");
    }
  };

  const openCredentialsModal = (device) => {
    setCredentialsDevice(device);
    setCredType("ssh");
    setCredData({ username: "", password: "", community_string: "" });
  };

  const saveCredentials = async () => {
    try {
      const payload =
        credType === "ssh"
          ? { type: "ssh", username: credData.username, password: credData.password }
          : { type: "snmp", community_string: credData.community_string };

      await api.post(`/devices/${credentialsDevice.id}/credentials`, payload);
      setCredentialsDevice(null);
    } catch {
      alert("Failed to save credentials.");
    }
  };

  const filteredDevices = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.ip_address.toLowerCase().includes(search.toLowerCase()) ||
      (d.location && d.location.toLowerCase().includes(search.toLowerCase())) ||
      (d.notes && d.notes.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / PAGE_SIZE));
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
          {(userRole === "admin" || userRole === "operator") && <li><Link to="/devices">Devices</Link></li>}
          {userRole === "admin" && <li><Link to="/users">Users</Link></li>}
          {userRole === "admin" && <li><Link to="/auditlogs">Audit Logs</Link></li>}
          <li><Link to="/settings">Settings</Link></li>
          <li><button className="logout-button" onClick={handleLogout}>Logout</button></li>
        </ul>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-card">
          <h1>Devices</h1>
          <button className="add-device-btn" onClick={() => setShowAddModal(true)}>
            Add Device
          </button>

          <input
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ margin: "15px 0", width: "100%", padding: "8px" }}
          />

          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>IP Address</th>
                <th>Type</th>
                <th>Location</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDevices.map((device) => (
                <tr key={device.id}>
                  <td>{device.name}</td>
                  <td>{device.ip_address}</td>
                  <td>{device.type}</td>
                  <td>{device.location || "-"}</td>
                  <td className="notes" title={device.notes || "-"}>
                    {device.notes || "-"}
                  </td>
                  <td>
                    <button onClick={() => setEditingDevice({ ...device })}>Edit</button>
                    <button className="danger" onClick={() => deleteDevice(device)}>
                      Delete
                    </button>
                    <button onClick={() => openCredentialsModal(device)}>Credentials</button>
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

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Device</h2>
            <form onSubmit={createDevice}>
              <input placeholder="Name" required value={newDevice.name} onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })} />
              <input placeholder="IP Address" required value={newDevice.ip_address} onChange={(e) => setNewDevice({ ...newDevice, ip_address: e.target.value })} />
              <select value={newDevice.type} onChange={(e) => setNewDevice({ ...newDevice, type: e.target.value })}>
                {DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input placeholder="Location" value={newDevice.location} onChange={(e) => setNewDevice({ ...newDevice, location: e.target.value })} />
              <input placeholder="Notes" value={newDevice.notes} onChange={(e) => setNewDevice({ ...newDevice, notes: e.target.value })} />
              <button type="submit">Create</button>
              <button type="button" onClick={() => setShowAddModal(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {editingDevice && (
        <div className="modal-overlay" onClick={() => setEditingDevice(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Device</h2>
            <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
              <input value={editingDevice.name} onChange={(e) => setEditingDevice({ ...editingDevice, name: e.target.value })} />
              <input value={editingDevice.ip_address} onChange={(e) => setEditingDevice({ ...editingDevice, ip_address: e.target.value })} />
              <select value={editingDevice.type} onChange={(e) => setEditingDevice({ ...editingDevice, type: e.target.value })}>
                {DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input value={editingDevice.location || ""} onChange={(e) => setEditingDevice({ ...editingDevice, location: e.target.value })} />
              <input value={editingDevice.notes || ""} onChange={(e) => setEditingDevice({ ...editingDevice, notes: e.target.value })} />
              <button type="submit">Save</button>
              <button type="button" onClick={() => setEditingDevice(null)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {credentialsDevice && (
        <div className="modal-overlay" onClick={() => setCredentialsDevice(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Credentials - {credentialsDevice.name}</h2>
            <div style={{ marginBottom: "10px" }}>
              <button onClick={() => setCredType("ssh")}>SSH</button>
              <button onClick={() => setCredType("snmp")} style={{ marginLeft: "10px" }}>
                SNMP
              </button>
            </div>

            {credType === "ssh" && (
              <>
                <input placeholder="Username" value={credData.username} onChange={(e) => setCredData({ ...credData, username: e.target.value })} />
                <input type="password" placeholder="Password" value={credData.password} onChange={(e) => setCredData({ ...credData, password: e.target.value })} />
              </>
            )}

            {credType === "snmp" && (
              <input
                placeholder="Community String"
                value={credData.community_string}
                onChange={(e) => setCredData({ ...credData, community_string: e.target.value })}
              />
            )}

            <button onClick={saveCredentials}>Save</button>
            <button onClick={() => setCredentialsDevice(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
