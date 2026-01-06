import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import "./Dashboard.css";

const ROLES = ["admin", "operator", "viewer"];
const PAGE_SIZE = 5;

export default function Users() {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem("access_token");

  const [users, setUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [formData, setFormData] = useState({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "viewer",
  });

  let currentUserEmail = null;
  let currentUserRole = null;

  if (accessToken) {
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      currentUserEmail = payload.sub;
      currentUserRole = payload.role;
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/");
    }
  }

  useEffect(() => {
    if (!accessToken) return navigate("/");
    if (currentUserRole !== "admin") return navigate("/dashboard");
    fetchUsers();
  }, [accessToken, currentUserRole, navigate]);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users/");
      setUsers(res.data);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/");
    }
  };

  const startEdit = (user) => {
    setEditingUserId(user.id);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
    });
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setFormData({});
  };

  const saveEdit = async (userId) => {
    try {
      await api.patch(`/users/${userId}`, formData);
      await fetchUsers();
      cancelEdit();
    } catch {
      alert("Failed to update user.");
    }
  };

  const deleteUser = async (user) => {
    if (user.email === currentUserEmail) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!window.confirm("Delete this user?")) return;

    try {
      await api.delete(`/users/${user.id}`);
      setUsers(users.filter((u) => u.id !== user.id));
    } catch {
      alert("Failed to delete user.");
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/register", newUser);
      setShowAddForm(false);
      setNewUser({ email: "", full_name: "", password: "", role: "viewer" });
      await fetchUsers();
    } catch {
      alert("Failed to create user.");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice(
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
          <li><Link to="/users">Users</Link></li>
          {currentUserRole === "admin" && <li><Link to="/auditlogs">Audit Logs</Link></li>}
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
          <h1>Users</h1>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ marginBottom: "15px" }}
          >
            {showAddForm ? "Cancel" : "Add User"}
          </button>
          {showAddForm && (
            <form onSubmit={createUser} style={{ marginBottom: "20px" }}>
              <input
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
              />
              <input
                placeholder="Full Name"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button type="submit">Create</button>
            </form>
          )}

          <input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: "15px", width: "100%", padding: "8px" }}
          />

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    {editingUserId === user.id ? (
                      <input
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    ) : (
                      user.email
                    )}
                  </td>
                  <td>
                    {editingUserId === user.id ? (
                      <input
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      />
                    ) : (
                      user.full_name
                    )}
                  </td>
                  <td>
                    {editingUserId === user.id ? (
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      user.role
                    )}
                  </td>
                  <td>
                    {editingUserId === user.id ? (
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      />
                    ) : (
                      user.is_active ? "Yes" : "No"
                    )}
                  </td>
                  <td>
                    {editingUserId === user.id ? (
                      <>
                        <button onClick={() => saveEdit(user.id)}>Save</button>
                        <button onClick={cancelEdit}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(user)}>Edit</button>
                        <button
                          style={{ backgroundColor: "#ef4444", color: "white" }}
                          onClick={() => deleteUser(user)}
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
