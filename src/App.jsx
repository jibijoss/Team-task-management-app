import { useState, useEffect, createContext, useContext, useRef } from "react";
import axios from "axios";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

// ─── Base API URL from environment ───────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─── Task status constants ────────────────────────────────────────────────────
const STATUS = {
  TODO:        "Todo",
  IN_PROGRESS: "In Progress",
  DONE:        "Done",
};

const STATUS_BADGE = {
  [STATUS.TODO]:        "badge-todo",
  [STATUS.IN_PROGRESS]: "badge-progress",
  [STATUS.DONE]:        "badge-done",
};

const TASKS_PER_PAGE = 10;


/* ═══════════════════════════════════════════════════════════════════
   AUTH CONTEXT
   — Stores the logged-in user AND the JWT token
   — Exposes login / logout and an authAxios helper that
     automatically attaches the token to every request
═══════════════════════════════════════════════════════════════════ */
const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [token, setToken] = useState(null);

  // Called after a successful login — stores both the user info and the token
  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
  };

  // Called on logout — clears everything
  const logout = () => {
    setUser(null);
    setToken(null);
  };

  // authAxios is a pre-configured axios instance that automatically adds
  // the Authorization header to every request so each component
  // doesn't have to do it manually.
  const authAxios = axios.create({ baseURL: API });
  authAxios.interceptors.request.use((config) => {
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  return (
    <AuthContext.Provider value={{ user, token, login, logout, authAxios }}>
      {children}
    </AuthContext.Provider>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   REUSABLE MODAL
   — Closes when clicking the dark backdrop
═══════════════════════════════════════════════════════════════════ */
function Modal({ title, onClose, children }) {
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   LOGIN PAGE
═══════════════════════════════════════════════════════════════════ */
function Login() {
  const navigate  = useNavigate();
  const { login } = useAuth();

  const [name,     setName]     = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res  = await axios.post(`${API}/login`, { name, password });
      const { user, token } = res.data;

      // Store both user info and the JWT token in context
      login(user, token);

      navigate(user.role === "admin" ? "/admin-dashboard" : "/user-dashboard");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h2>Welcome back</h2>
        <p className="sub">Sign in to your workspace</p>

        <div className="field">
          <label>Name</label>
          <input
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button className="btn btn-primary btn-full" onClick={handleLogin} disabled={loading}>
          {loading ? "Signing in…" : "Sign In →"}
        </button>

        <div className="divider" />
        <p className="text-muted text-center">
          No account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   REGISTER PAGE
═══════════════════════════════════════════════════════════════════ */
function Register() {
  const navigate = useNavigate();

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState("user");
  const [loading,  setLoading]  = useState(false);

  const validate = () => {
    if (!name.trim())         { toast.error("Name is required");                       return false; }
    if (!email.trim())        { toast.error("Email is required");                      return false; }
    if (!email.includes("@")) { toast.error("Enter a valid email");                    return false; }
    if (!password.trim())     { toast.error("Password is required");                   return false; }
    if (password.length < 6)  { toast.error("Password must be at least 6 characters"); return false; }
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/register`, { name, email, password, role });
      toast.success(res.data.message);
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h2>Create account</h2>
        <p className="sub">Join the workspace</p>

        <div className="field">
          <label>Name</label>
          <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password" placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button className="btn btn-primary btn-full" onClick={handleRegister} disabled={loading}>
          {loading ? "Creating…" : "Create Account"}
        </button>

        <div className="divider" />
        <p className="text-muted text-center">
          Already registered? <Link to="/">Sign in</Link>
        </p>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   SIDEBAR NAVIGATION
═══════════════════════════════════════════════════════════════════ */
function Sidebar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  const navItems = [
    { id: "overview", label: "Overview" },
    { id: "projects", label: "Projects" },
    { id: "tasks",    label: "Tasks"    },
  ];

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">◈ Workspace</div>
      <div className="sidebar-section">Navigation</div>

      {navItems.map((item) => (
        <button
          key={item.id}
          className={`sidebar-item ${activeTab === item.id ? "active" : ""}`}
          onClick={() => setActiveTab(item.id)}
        >
          {item.label}
        </button>
      ))}

      <div className="sidebar-bottom">
        <div className="user-pill">
          <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div>
            <div className="user-name">{user?.name}</div>
            <span className={`badge badge-${user?.role}`}>{user?.role}</span>
          </div>
        </div>
        <button className="sidebar-item logout-btn" onClick={handleLogout}>⏻ Logout</button>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   OVERVIEW PANEL
═══════════════════════════════════════════════════════════════════ */
function OverviewPanel({ user, refreshKey }) {
  const { authAxios }               = useAuth();
  const [stats,     setStats]       = useState({ projects: 0, todo: 0, inProgress: 0, done: 0 });
  const [doneTasks, setDoneTasks]   = useState([]);

  useEffect(() => { loadStats(); }, [refreshKey]);

  const loadStats = async () => {
    try {
      // authAxios automatically sends the JWT token — no manual header needed
      const [projectsRes, tasksRes] = await Promise.all([
        authAxios.get("/projects"),
        authAxios.get("/tasks", { params: { page: 1, limit: 50 } }),
      ]);
      const tasks = tasksRes.data.tasks || [];
      setStats({
        projects:   projectsRes.data.length,
        todo:       tasks.filter((t) => t.status === STATUS.TODO).length,
        inProgress: tasks.filter((t) => t.status === STATUS.IN_PROGRESS).length,
        done:       tasks.filter((t) => t.status === STATUS.DONE).length,
      });
      setDoneTasks(tasks.filter((t) => t.status === STATUS.DONE));
    } catch { /* silently ignore */ }
  };

  const adminAccess = [
    "✓ Create, edit, and delete projects",
    "✓ Assign members to projects",
    "✓ Create, assign tasks with instructions",
    "✓ Move any task between statuses",
    "✓ View all users",
  ];
  const userAccess = [
    "✓ View projects you are a member of",
    "✓ View tasks assigned to you",
    "✓ Write work log and submit to mark Done",
    "✓ Upload files for In Progress tasks",
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Overview</div>
          <div className="page-subtitle">Hello, {user.name} — here's your workspace at a glance</div>
        </div>
        <span className={`badge badge-${user.role}`}>
          {user.role === "admin" ? "👑" : "👤"} {user.role}
        </span>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-num stat-accent">{stats.projects}</div><div className="stat-label">Projects</div></div>
        <div className="stat-card"><div className="stat-num stat-muted">{stats.todo}</div><div className="stat-label">To Do</div></div>
        <div className="stat-card"><div className="stat-num stat-warn">{stats.inProgress}</div><div className="stat-label">In Progress</div></div>
        <div className="stat-card"><div className="stat-num stat-success">{stats.done}</div><div className="stat-label">Done</div></div>
      </div>

      {doneTasks.length > 0 && (
        <div className="card" style={{ marginBottom: "20px" }}>
          <div className="card-title">✅ Completed Tasks</div>
          <div className="done-task-list">
            {doneTasks.map((task) => (
              <div className="done-task-item" key={task._id}>
                <span className="done-task-name">{task.title}</span>
                {task.workLog && <span className="done-task-log">"{task.workLog}"</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Your Access Level</div>
        <ul className="access-list">
          {(user.role === "admin" ? adminAccess : userAccess).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
          {user.role !== "admin" && (
            <li className="denied">✗ Cannot create or delete projects/tasks</li>
          )}
        </ul>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   PROJECTS PANEL
═══════════════════════════════════════════════════════════════════ */
function ProjectsPanel({ user }) {
  const { authAxios } = useAuth();
  const isAdmin = user.role === "admin";

  const [projects,  setProjects]  = useState([]);
  const [allUsers,  setAllUsers]  = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState({ name: "", description: "", memberIds: [] });

  useEffect(() => {
    loadProjects();
    if (isAdmin) loadUsers();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await authAxios.get("/projects");
      setProjects(res.data);
    } catch { /* silently ignore */ }
  };

  const loadUsers = async () => {
    try {
      const res = await authAxios.get("/users");
      setAllUsers(res.data);
    } catch { /* silently ignore */ }
  };

  const openCreateModal = () => {
    setEditing(null);
    setForm({ name: "", description: "", memberIds: [] });
    setShowModal(true);
  };

  const openEditModal = (project) => {
    setEditing(project);
    setForm({ name: project.name, description: project.description, memberIds: project.memberIds || [] });
    setShowModal(true);
  };

  const toggleMember = (userId) => {
    setForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(userId)
        ? prev.memberIds.filter((id) => id !== userId)
        : [...prev.memberIds, userId],
    }));
  };

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const saveProject = async () => {
    try {
      if (editing) {
        await authAxios.put(`/projects/${editing._id}`, form);
      } else {
        await authAxios.post("/projects", form);
      }
      setShowModal(false);
      loadProjects();
    } catch { alert("Failed to save project"); }
  };

  const deleteProject = async (id) => {
    if (!window.confirm("Delete this project?")) return;
    try {
      await authAxios.delete(`/projects/${id}`);
      loadProjects();
    } catch { alert("Failed to delete project"); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Projects</div>
          <div className="page-subtitle">
            {isAdmin ? "Manage projects and assign team members" : "Projects you are part of"}
          </div>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openCreateModal}>+ New Project</button>}
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◈</div>
          <p>No projects yet{isAdmin ? " — create one above" : ""}</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {projects.map((project) => (
            <div className="card" key={project._id}>
              <div className="card-header">
                <div>
                  <div className="card-title">{project.name}</div>
                  <div className="card-desc">{project.description}</div>
                </div>
                {isAdmin && (
                  <div className="card-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => openEditModal(project)}>✎</button>
                    <button className="btn btn-danger  btn-sm" onClick={() => deleteProject(project._id)}>×</button>
                  </div>
                )}
              </div>
              <div className="divider" />
              <div className="members-label">◉ MEMBERS</div>
              <div className="members-row">
                {(project.memberIds || []).length === 0 ? (
                  <span className="text-muted">No members assigned</span>
                ) : (
                  project.memberIds.map((memberId) => {
                    const member = allUsers.find((u) => u._id === memberId);
                    return member ? <span className="member-chip" key={memberId}>{member.name}</span> : null;
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && isAdmin && (
        <Modal title={editing ? "Edit Project" : "New Project"} onClose={() => setShowModal(false)}>
          <div className="field">
            <label>Project Name</label>
            <input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="e.g. Website Redesign" />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="What is this project about?" />
          </div>
          <div className="field">
            <label>Assign Members</label>
            <div className="checkbox-group">
              {allUsers.map((u) => (
                <label className="checkbox-item" key={u._id}>
                  <input type="checkbox" checked={form.memberIds.includes(u._id)} onChange={() => toggleMember(u._id)} />
                  <span>{u.name}</span>
                  <span className={`badge badge-${u.role}`}>{u.role}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveProject}>Save Project</button>
          </div>
        </Modal>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   USER TASK CARD
   — Todo:        "Start Task" button
   — In Progress: work log + file upload + submit
   — Done:        read-only submitted work log
═══════════════════════════════════════════════════════════════════ */
function UserTaskCard({ task, projectName, onRefresh }) {
  const { authAxios } = useAuth();

  const [workLog,        setWorkLog]        = useState(task.workLog || "");
  const [submitting,     setSubmitting]     = useState(false);
  const [uploadFile,     setUploadFile]     = useState(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles,  setUploadedFiles]  = useState(task.attachments || []);
  const fileInputRef = useRef(null);

  const isTodo       = task.status === STATUS.TODO;
  const isInProgress = task.status === STATUS.IN_PROGRESS;
  const isDone       = task.status === STATUS.DONE;

  const startTask = async () => {
    try {
      await authAxios.patch(`/tasks/${task._id}/status`, { status: STATUS.IN_PROGRESS });
      onRefresh();
    } catch { alert("Could not start task"); }
  };

  const submitWork = async () => {
    if (!workLog.trim()) { alert("Please write what you did before submitting."); return; }
    setSubmitting(true);
    try {
      await authAxios.patch(`/tasks/${task._id}/submit`, { workLog });
      onRefresh();
    } catch { alert("Submit failed"); }
    finally { setSubmitting(false); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setUploadFile(file);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("file", uploadFile);
    try {
      const res = await authAxios.post(`/tasks/${task._id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total)),
      });
      setUploadedFiles((prev) => [...prev, res.data.file]);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("File uploaded successfully");
    } catch { toast.error("File upload failed"); }
    finally { setUploading(false); setUploadProgress(0); }
  };

  const statusBadgeClass =
    task.status === STATUS.TODO        ? "badge-todo"     :
    task.status === STATUS.IN_PROGRESS ? "badge-progress" : "badge-done";

  return (
    <div className={`task-card task-card--${task.status.toLowerCase().replace(" ", "-")}`}>

      <div className="task-card-header-row">
        <div className="task-card-title">{task.title}</div>
        <span className={`badge ${statusBadgeClass}`}>{task.status}</span>
      </div>

      <div className="task-card-meta"><span>◈ {projectName}</span></div>

      {task.description && (
        <div className="task-instructions">
          <div className="task-instructions-label">📋 Instructions</div>
          <div className="task-instructions-text">{task.description}</div>
        </div>
      )}

      {/* ── TODO ── */}
      {isTodo && (
        <div className="task-actions">
          <button className="btn btn-outline btn-sm" onClick={startTask}>▶ Start Task</button>
        </div>
      )}

      {/* ── IN PROGRESS ── */}
      {isInProgress && (
        <div className="work-log-section">
          <label className="work-log-label">✍ What did you do?</label>
          <textarea
            className="work-log-input" rows={4}
            placeholder="Describe what you completed or the progress made…"
            value={workLog} onChange={(e) => setWorkLog(e.target.value)}
          />

          <div className="upload-section">
            <div className="upload-section-label">📎 Attach a File</div>
            <div className="upload-drop-zone" onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" className="upload-hidden-input" onChange={handleFileChange} />
              {uploadFile ? (
                <div className="upload-file-chosen">
                  <span className="upload-file-icon">📄</span>
                  <span className="upload-file-name">{uploadFile.name}</span>
                  <span className="upload-file-size">({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <span className="upload-placeholder-icon">⬆</span>
                  <span>Click to choose a file from your desktop</span>
                </div>
              )}
            </div>

            {uploading && (
              <div className="upload-progress-wrap">
                <div className="upload-progress-bar-track">
                  <div className="upload-progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="upload-progress-text">
                  <span className="upload-spinner" /> Uploading… {uploadProgress}%
                </div>
              </div>
            )}

            {uploadFile && !uploading && (
              <button className="btn btn-outline btn-full upload-btn" onClick={handleUpload}>⬆ Upload File</button>
            )}

            {uploadedFiles.length > 0 && (
              <div className="uploaded-files-list">
                <div className="uploaded-files-label">✅ Uploaded Files</div>
                {uploadedFiles.map((file, index) => (
                  <a key={index} href={`${API}/uploads/${file.filename}`} target="_blank" rel="noreferrer" className="uploaded-file-item">
                    📄 {file.originalname}
                  </a>
                ))}
              </div>
            )}
          </div>

          <button className="btn btn-primary btn-full" onClick={submitWork} disabled={submitting}>
            {submitting ? "Submitting…" : "✓ Submit & Mark Done"}
          </button>
        </div>
      )}

      {/* ── DONE ── */}
      {isDone && task.workLog && (
        <div className="work-log-done">
          <div className="work-log-done-label">✅ Submitted Work</div>
          <div className="work-log-done-text">{task.workLog}</div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   PAGINATION BAR
═══════════════════════════════════════════════════════════════════ */
function Pagination({ page, pages, total, limit, onPageChange }) {
  if (pages <= 1) return null;

  const firstItem   = (page - 1) * limit + 1;
  const lastItem    = Math.min(page * limit, total);
  const pageNumbers = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) pageNumbers.push(i);

  return (
    <div className="pagination">
      <span className="pagination-info">Showing {firstItem}–{lastItem} of {total} tasks</span>
      <div className="pagination-controls">
        <button className="page-btn" onClick={() => onPageChange(1)}        disabled={page === 1}>«</button>
        <button className="page-btn" onClick={() => onPageChange(page - 1)} disabled={page === 1}>‹</button>
        {pageNumbers[0] > 1 && <span className="page-ellipsis">…</span>}
        {pageNumbers.map((n) => (
          <button key={n} className={`page-btn ${n === page ? "page-btn--active" : ""}`} onClick={() => onPageChange(n)}>{n}</button>
        ))}
        {pageNumbers[pageNumbers.length - 1] < pages && <span className="page-ellipsis">…</span>}
        <button className="page-btn" onClick={() => onPageChange(page + 1)} disabled={page === pages}>›</button>
        <button className="page-btn" onClick={() => onPageChange(pages)}    disabled={page === pages}>»</button>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   TASKS PANEL
═══════════════════════════════════════════════════════════════════ */
function TasksPanel({ user, onTaskDone }) {
  const { authAxios } = useAuth();
  const isAdmin = user.role === "admin";

  const [tasks,         setTasks]         = useState([]);
  const [page,          setPage]          = useState(1);
  const [pages,         setPages]         = useState(1);
  const [total,         setTotal]         = useState(0);
  const [filterProject, setFilterProject] = useState("all");
  const [projects,      setProjects]      = useState([]);
  const [allUsers,      setAllUsers]      = useState([]);
  const [showModal,     setShowModal]     = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [form,          setForm]          = useState({
    title: "", description: "", projectId: "", assignedTo: "", status: STATUS.TODO,
  });

  useEffect(() => {
    loadSupportData();
    loadTasks(1, "all");
  }, []);

  const loadSupportData = async () => {
    try {
      const [projectsRes, usersRes] = await Promise.all([
        authAxios.get("/projects"),
        isAdmin ? authAxios.get("/users") : Promise.resolve({ data: [] }),
      ]);
      setProjects(projectsRes.data);
      setAllUsers(usersRes.data);
    } catch { /* silently ignore */ }
  };

  const loadTasks = async (pageNum, projectFilter) => {
    try {
      const res = await authAxios.get("/tasks", {
        params: { page: pageNum, limit: TASKS_PER_PAGE, project: projectFilter },
      });
      setTasks(res.data.tasks);
      setPage(res.data.page);
      setPages(res.data.pages);
      setTotal(res.data.total);
    } catch { /* silently ignore */ }
  };

  const handleFilterChange = (projectId) => { setFilterProject(projectId); loadTasks(1, projectId); };
  const handlePageChange   = (newPage)    => loadTasks(newPage, filterProject);
  const handleRefresh      = ()           => { loadTasks(page, filterProject); onTaskDone(); };

  const openCreateModal = () => {
    setEditing(null);
    setForm({ title: "", description: "", projectId: projects[0]?._id || "", assignedTo: "", status: STATUS.TODO });
    setShowModal(true);
  };

  const openEditModal = (task) => {
    setEditing(task);
    setForm({ title: task.title, description: task.description, projectId: task.projectId, assignedTo: task.assignedTo, status: task.status });
    setShowModal(true);
  };

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const saveTask = async () => {
    try {
      if (editing) {
        await authAxios.put(`/tasks/${editing._id}`, form);
      } else {
        await authAxios.post("/tasks", form);
      }
      setShowModal(false);
      handleRefresh();
    } catch { alert("Failed to save task"); }
  };

  const deleteTask = async (id) => {
    if (!window.confirm("Delete task?")) return;
    try {
      await authAxios.delete(`/tasks/${id}`);
      const targetPage = tasks.length === 1 && page > 1 ? page - 1 : page;
      loadTasks(targetPage, filterProject);
      onTaskDone();
    } catch { alert("Failed to delete task"); }
  };

  const tasksByStatus  = (status) => tasks.filter((t) => t.status === status);
  const getProjectName = (id)     => projects.find((p) => p._id === id)?.name || "—";
  const getUserName    = (id)     => allUsers.find((u) => u._id === id)?.name || (id === user.id ? user.name : "—");

  const selectedProject = projects.find((p) => p._id === form.projectId);
  const projectMembers  = selectedProject
    ? allUsers.filter((u) => selectedProject.memberIds.includes(u._id))
    : [];

  const KanbanColumn = ({ status, children }) => (
    <div className="task-col">
      <div className="task-col-header">
        <span className={`badge ${STATUS_BADGE[status]}`}>{status}</span>
        <span className="task-col-count">{tasksByStatus(status).length}</span>
      </div>
      {tasksByStatus(status).length === 0 && <div className="task-col-empty">Empty</div>}
      {children}
    </div>
  );

  // ── USER VIEW ─────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">My Tasks</div>
            <div className="page-subtitle">Tasks assigned to you — write your work and submit when done</div>
          </div>
          <select className="filter-select" value={filterProject} onChange={(e) => handleFilterChange(e.target.value)}>
            <option value="all">All Projects</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>

        <div className="task-board">
          {Object.values(STATUS).map((status) => (
            <KanbanColumn key={status} status={status}>
              {tasksByStatus(status).map((task) => (
                <UserTaskCard key={task._id} task={task} projectName={getProjectName(task.projectId)} onRefresh={handleRefresh} />
              ))}
            </KanbanColumn>
          ))}
        </div>

        <Pagination page={page} pages={pages} total={total} limit={TASKS_PER_PAGE} onPageChange={handlePageChange} />
      </div>
    );
  }

  // ── ADMIN VIEW ────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Tasks</div>
          <div className="page-subtitle">Assign and manage all project tasks</div>
        </div>
        <div className="header-actions">
          <select className="filter-select" value={filterProject} onChange={(e) => handleFilterChange(e.target.value)}>
            <option value="all">All Projects</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={openCreateModal}>+ New Task</button>
        </div>
      </div>

      <div className="task-board">
        {Object.values(STATUS).map((status) => (
          <KanbanColumn key={status} status={status}>
            {tasksByStatus(status).map((task) => (
              <div className="task-card" key={task._id}>
                <div className="task-card-header-row">
                  <div className="task-card-title">{task.title}</div>
                </div>
                {task.description && <div className="task-card-desc">{task.description}</div>}
                <div className="task-card-meta">
                  <span>◈ {getProjectName(task.projectId)}</span>
                  <span>◉ {getUserName(task.assignedTo)}</span>
                </div>
                {task.workLog && (
                  <div className="work-log-done" style={{ marginTop: "10px" }}>
                    <div className="work-log-done-label">📝 User's Work</div>
                    <div className="work-log-done-text">{task.workLog}</div>
                  </div>
                )}
                {task.attachments?.length > 0 && (
                  <div className="uploaded-files-list" style={{ marginTop: "10px" }}>
                    <div className="uploaded-files-label">📎 Attachments</div>
                    {task.attachments.map((file, i) => (
                      <a key={i} href={`${API}/uploads/${file.filename}`} target="_blank" rel="noreferrer" className="uploaded-file-item">
                        📄 {file.originalname}
                      </a>
                    ))}
                  </div>
                )}
                <div className="task-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => openEditModal(task)}>✎</button>
                  <button className="btn btn-danger  btn-sm" onClick={() => deleteTask(task._id)}>×</button>
                </div>
              </div>
            ))}
          </KanbanColumn>
        ))}
      </div>

      <Pagination page={page} pages={pages} total={total} limit={TASKS_PER_PAGE} onPageChange={handlePageChange} />

      {showModal && (
        <Modal title={editing ? "Edit Task" : "New Task"} onClose={() => setShowModal(false)}>
          <div className="field">
            <label>Task Title</label>
            <input value={form.title} onChange={(e) => updateForm("title", e.target.value)} placeholder="e.g. Design landing page" />
          </div>
          <div className="field">
            <label>Instructions for the user</label>
            <textarea rows={4} value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="Describe exactly what the user should do…" />
          </div>
          <div className="field">
            <label>Project</label>
            <select value={form.projectId} onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value, assignedTo: "" }))}>
              <option value="">— Select project —</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Assign To</label>
            <select value={form.assignedTo} onChange={(e) => updateForm("assignedTo", e.target.value)}>
              <option value="">— Select user —</option>
              {projectMembers.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveTask}>Save Task</button>
          </div>
        </Modal>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD SHELL
═══════════════════════════════════════════════════════════════════ */
function Dashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [activeTab,  setActiveTab]  = useState("overview");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { if (!user) navigate("/"); }, [user]);
  if (!user) return null;

  const refreshOverview = () => setRefreshKey((k) => k + 1);

  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main-content">
        {activeTab === "overview" && <OverviewPanel user={user} refreshKey={refreshKey} />}
        {activeTab === "projects" && <ProjectsPanel user={user} />}
        {activeTab === "tasks"    && <TasksPanel    user={user} onTaskDone={refreshOverview} />}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════════════════════════ */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastContainer position="top-right" autoClose={3000} />
        <Routes>
          <Route path="/"                element={<Login />}     />
          <Route path="/register"        element={<Register />}  />
          <Route path="/admin-dashboard" element={<Dashboard />} />
          <Route path="/user-dashboard"  element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
