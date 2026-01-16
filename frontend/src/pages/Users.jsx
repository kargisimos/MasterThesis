import React, { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

const ROLES = ["admin", "operator", "viewer"];
const PAGE_SIZE = 10;

export default function Users() {
  const { userRole, logout } = useAuth();
  
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
    is_active: true,
  });

  let currentUserEmail = null;
  const token = localStorage.getItem("access_token");
  if (token) {
      try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          currentUserEmail = payload.sub;
      } catch (e) {
         
      }
  }

  const [message, setMessage] = useState(null);

  const showSuccess = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users/");
      setUsers(res.data);
      setPage(1);
    } catch {
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/register", newUser);
      setShowAddModal(false);
      setShowAddModal(false);
      setNewUser({ email: "", full_name: "", password: "", role: "viewer", is_active: true });
      fetchUsers();
      fetchUsers();
      showSuccess("User created successfully!");
    } catch {
      alert("Failed to create user.");
    }
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/users/${editingUser.id}`, editingUser);
      setEditingUser(null);
      fetchUsers();
      showSuccess("User updated successfully!");
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
      showSuccess("User deleted.");
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

  return (
    <div className="dashboard-card">
      <h1>Users</h1>

      {message && (
        <div style={{ 
          padding: "12px 16px", 
          backgroundColor: "var(--success-muted)", 
          color: "var(--success-text)", 
          borderRadius: "8px", 
          marginBottom: "16px",
          border: "1px solid var(--success)",
          fontWeight: "500",
          animation: "fadeIn 0.3s ease-out"
        }}>
          ✓ {message}
        </div>
      )}

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
          <col style={{ width: "35%" }} />
          <col style={{ width: "35%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "12%" }} />
        </colgroup>

        <thead>
          <tr>
            <th>Email</th>
            <th>Full Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {paginatedUsers.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.full_name}</td>
              <td>{user.role}</td>
              <td style={{ textAlign: "center" }}>
                <span style={{ 
                  padding: "4px 8px", 
                  borderRadius: "12px", 
                  backgroundColor: user.is_active ? "#d1fae5" : "#f3f4f6", 
                  color: user.is_active ? "#065f46" : "#6b7280",
                  fontSize: "0.75rem",
                  fontWeight: "600"
                }}>
                  {user.is_active ? "ACTIVE" : "INACTIVE"}
                </span>
              </td>
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
              <select
                value={newUser.is_active ? "Active" : "Inactive"}
                onChange={(e) => setNewUser({ ...newUser, is_active: e.target.value === "Active" })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
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
                value={editingUser.is_active ? "Active" : "Inactive"}
                onChange={(e) =>
                  setEditingUser({
                    ...editingUser,
                    is_active: e.target.value === "Active",
                  })
                }
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
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
