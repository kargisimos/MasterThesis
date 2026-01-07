import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import "./Dashboard.css";

const ROLES = ["admin", "operator", "viewer"];
const PAGE_SIZE = 10;

export default function Users() {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem("access_token");

  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
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
      setPage(1);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/");
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/register", newUser);
      setShowAddModal(false);
      setNewUser({ email: "", full_name: "", password: "", role: "viewer" });
      fetchUsers();
    } catch {
      alert("Failed to create user.");
    }
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/users/${editingUser.id}`, editingUser);
      setEditingUser(null);
      fetchUsers();
    } catch {
      alert("Failed to update user.");
    }
  };

  const deleteUser = async (user) => {
    if (user.email === currentUserEmail) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!window.confirm(`Delete user "${user.email}"?`)) return;

    try {
      await api.delete(`/users/${user.id}`);
      setUsers(users.filter((u) => u.id !== user.id));
    } catch {
      alert("Failed to delete user.");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
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
          {(currentUserRole === "admin" || currentUserRole === "operator") && (
            <li><Link to="/devices">Devices</Link></li>
          )}
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

          <button className="add-device-btn" onClick={() => setShowAddModal(true)}>
            Add User
          </button>

          <input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ margin: "15px 0", width: "100%", padding: "8px" }}
          />

          <table className="data-table">
            <colgroup>
              <col style={{ width: "35%" }} /> {/* Email */}
              <col style={{ width: "35%" }} /> {/* Full Name */}
              <col style={{ width: "10%" }} /> {/* Role */}
              <col style={{ width: "8%" }} />  {/* Active */}
              <col style={{ width: "12%" }} /> {/* Actions */}
            </colgroup>

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
                  <td>{user.email}</td>
                  <td>{user.full_name}</td>
                  <td>{user.role}</td>
                  <td>{user.is_active ? "Yes" : "No"}</td>
                  <td>
                    <button onClick={() => setEditingUser({ ...user })}>
                      Edit
                    </button>
                    <button className="danger" onClick={() => deleteUser(user)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Prev
            </button>
            <span style={{ margin: "0 10px" }}>
              Page {page} / {totalPages}
            </span>
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </div>
      </main>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add User</h2>
            <form onSubmit={createUser}>
              <input
                placeholder="Email"
                required
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
              />
              <input
                placeholder="Full Name"
                required
                value={newUser.full_name}
                onChange={(e) =>
                  setNewUser({ ...newUser, full_name: e.target.value })
                }
              />
              <input
                type="password"
                placeholder="Password"
                required
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
              />
              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser({ ...newUser, role: e.target.value })
                }
              >
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <button type="submit">Create</button>
              <button type="button" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit User</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit();
              }}
            >
              <input
                value={editingUser.email}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, email: e.target.value })
                }
              />
              <input
                value={editingUser.full_name}
                onChange={(e) =>
                  setEditingUser({
                    ...editingUser,
                    full_name: e.target.value,
                  })
                }
              />
              <select
                value={editingUser.role}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, role: e.target.value })
                }
              >
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <select
                value={editingUser.is_active}
                onChange={(e) =>
                  setEditingUser({
                    ...editingUser,
                    is_active: e.target.value === "true",
                  })
                }
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <button type="submit">Save</button>
              <button type="button" onClick={() => setEditingUser(null)}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
