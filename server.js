import "dotenv/config";
import express  from "express";
import mongoose from "mongoose";
import cors     from "cors";
import bcrypt   from "bcrypt";
import jwt      from "jsonwebtoken";   // ← NEW
import multer   from "multer";
import path     from "path";
import { fileURLToPath } from "url";
import fs       from "fs";

/* ═══════════════════════════════════════════════════════════════════
   ENV VALUES
═══════════════════════════════════════════════════════════════════ */
const PORT             = process.env.PORT                       || 5000;
const MONGO_URI        = process.env.MONGO_URI                  || "mongodb://127.0.0.1:27017/project";
const CLIENT_ORIGIN    = process.env.CLIENT_ORIGIN              || "http://localhost:5173";
const JWT_SECRET       = process.env.JWT_SECRET                 || "fallback_dev_secret";
const JWT_EXPIRES_IN   = process.env.JWT_EXPIRES_IN             || "7d";
const SALT_ROUNDS      = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
const UPLOAD_FOLDER    = process.env.UPLOAD_DIR                 || "uploads";
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB)   || 50;

/* ═══════════════════════════════════════════════════════════════════
   APP SETUP
═══════════════════════════════════════════════════════════════════ */
const app = express();
app.use(express.json());
app.use(cors({ origin: CLIENT_ORIGIN }));

/* ═══════════════════════════════════════════════════════════════════
   STATIC UPLOADS
═══════════════════════════════════════════════════════════════════ */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, UPLOAD_FOLDER);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

/* ═══════════════════════════════════════════════════════════════════
   MULTER
═══════════════════════════════════════════════════════════════════ */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 } });

/* ═══════════════════════════════════════════════════════════════════
   MONGODB
═══════════════════════════════════════════════════════════════════ */
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => { console.error("❌ MongoDB error:", err.message); process.exit(1); });

mongoose.connection.on("disconnected", () => console.warn("⚠️  MongoDB disconnected"));
mongoose.connection.on("reconnected",  () => console.log("🔄 MongoDB reconnected"));

/* ═══════════════════════════════════════════════════════════════════
   SCHEMAS & MODELS
═══════════════════════════════════════════════════════════════════ */
const userSchema = new mongoose.Schema({
  name:     String,
  email:    { type: String, unique: true },
  password: String,
  role:     { type: String, enum: ["admin", "user"], default: "user" },
});
const User = mongoose.model("User", userSchema);

const projectSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: "" },
  memberIds:   [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });
const Project = mongoose.model("Project", projectSchema);

const taskSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, default: "" },
  workLog:     { type: String, default: "" },
  projectId:   { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status:      { type: String, enum: ["Todo", "In Progress", "Done"], default: "Todo" },
  attachments: [{ filename: String, originalname: String, mimetype: String, size: Number }],
}, { timestamps: true });
const Task = mongoose.model("Task", taskSchema);

/* ═══════════════════════════════════════════════════════════════════
   HELPER — asyncHandler
   Wraps async routes so thrown errors go to the global error handler
   automatically — no try/catch needed inside route functions.
═══════════════════════════════════════════════════════════════════ */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* ═══════════════════════════════════════════════════════════════════
   MIDDLEWARE — verifyToken
   ─────────────────────────────────────────────────────────────────
   Reads the JWT from the Authorization header, verifies it with the
   secret, and attaches the decoded payload to req.user.

   Every protected route must use this middleware FIRST.

   Header the frontend must send:
     Authorization: Bearer <token>
═══════════════════════════════════════════════════════════════════ */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Header must exist and start with "Bearer "
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied. Please log in." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // jwt.verify throws if the token is expired or tampered with
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, name, role }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token. Please log in again." });
  }
};

/* ═══════════════════════════════════════════════════════════════════
   MIDDLEWARE — requireAdmin
   ─────────────────────────────────────────────────────────────────
   Must be placed AFTER verifyToken in the route chain.
   Blocks the request with 403 if the user is not an admin.

   Usage:  app.post("/projects", verifyToken, requireAdmin, handler)
═══════════════════════════════════════════════════════════════════ */
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden. Admin access required." });
  }
  next();
};

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC ROUTES  (no token needed)
═══════════════════════════════════════════════════════════════════ */
app.get("/", (req, res) => res.send("Server running"));

/* ── Register ── */
app.post("/register", asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name?.trim())     return res.status(400).json({ message: "Name is required" });
  if (!email?.trim())    return res.status(400).json({ message: "Email is required" });
  if (!password?.trim()) return res.status(400).json({ message: "Password is required" });

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: "Email already registered" });

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = new User({ name, email, password: hashedPassword, role: role || "user" });
  await user.save();

  res.status(201).json({
    message: "User registered successfully",
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}));

/* ── Login — issues a JWT on success ── */
app.post("/login", asyncHandler(async (req, res) => {
  const { name, password } = req.body;
  if (!name?.trim())     return res.status(400).json({ message: "Name is required" });
  if (!password?.trim()) return res.status(400).json({ message: "Password is required" });

  const user = await User.findOne({ name });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

  // Sign a JWT containing the user's id, name, and role.
  // The frontend stores this token and sends it in every subsequent request.
  const token = jwt.sign(
    { id: user._id, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({
    message: "Login successful",
    token,                        // ← frontend must store and use this
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}));

/* ═══════════════════════════════════════════════════════════════════
   PROTECTED ROUTES  (token required for everything below)
   Role enforcement is done in the BACKEND via middleware — not just
   the frontend. A regular user cannot call admin routes even if they
   modify the browser UI.
═══════════════════════════════════════════════════════════════════ */

/* ── Users: admin only ──────────────────────────────────────────── */
app.get("/users",
  verifyToken, requireAdmin,   // 🔒 admin only
  asyncHandler(async (req, res) => {
    const users = await User.find({}, "-password");
    res.json(users);
  })
);

/* ── Projects ────────────────────────────────────────────────────── */

// GET — any logged-in user; backend filters by role from the token
app.get("/projects",
  verifyToken,                 // 🔒 must be logged in
  asyncHandler(async (req, res) => {
    // Role and id come from the verified token — not from the query string.
    // This prevents a user from spoofing ?role=admin in the URL.
    const filter = req.user.role === "admin"
      ? {}                             // admin sees all projects
      : { memberIds: req.user.id };    // user sees only their projects

    const projects = await Project.find(filter).sort({ createdAt: -1 });
    res.json(projects);
  })
);

// POST — admin only: create project
app.post("/projects",
  verifyToken, requireAdmin,   // 🔒 admin only
  asyncHandler(async (req, res) => {
    const { name, description, memberIds } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Project name is required" });

    const project = new Project({ name, description, memberIds: memberIds || [] });
    await project.save();
    res.status(201).json(project);
  })
);

// PUT — admin only: edit project
app.put("/projects/:id",
  verifyToken, requireAdmin,   // 🔒 admin only
  asyncHandler(async (req, res) => {
    const { name, description, memberIds } = req.body;
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { name, description, memberIds: memberIds || [] },
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  })
);

// DELETE — admin only: delete project + cascade delete its tasks
app.delete("/projects/:id",
  verifyToken, requireAdmin,   // 🔒 admin only
  asyncHandler(async (req, res) => {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    await Task.deleteMany({ projectId: req.params.id });
    res.json({ message: "Project and its tasks deleted" });
  })
);

/* ── Tasks ───────────────────────────────────────────────────────── */

// GET — any logged-in user; backend filters by role from the token
app.get("/tasks",
  verifyToken,                 // 🔒 must be logged in
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, project } = req.query;

    // Role comes from the verified token — not query params.
    const filter = req.user.role === "admin"
      ? {}                              // admin sees all tasks
      : { assignedTo: req.user.id };    // user sees only assigned tasks

    if (project && project !== "all") filter.projectId = project;

    const skip = (page - 1) * limit;
    const [tasks, total] = await Promise.all([
      Task.find(filter).sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit)),
      Task.countDocuments(filter),
    ]);

    res.json({ tasks, total, page: Number(page), pages: Math.ceil(total / limit) });
  })
);

// POST — admin only: create task
app.post("/tasks",
  verifyToken, requireAdmin,   // 🔒 admin only
  asyncHandler(async (req, res) => {
    const { title, description, projectId, assignedTo, status } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: "Task title is required" });
    if (!projectId)     return res.status(400).json({ message: "Project is required" });

    const task = new Task({
      title, description, projectId,
      assignedTo: assignedTo || null,
      status: status || "Todo",
    });
    await task.save();
    res.status(201).json(task);
  })
);

// PUT — admin only: fully edit a task
app.put("/tasks/:id",
  verifyToken, requireAdmin,   // 🔒 admin only
  asyncHandler(async (req, res) => {
    const { title, description, projectId, assignedTo, status } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { title, description, projectId, assignedTo, status },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  })
);

// PATCH /status — user moves their own task Todo→InProgress; admin can move any
app.patch("/tasks/:id/status",
  verifyToken,                 // 🔒 must be logged in
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!["Todo", "In Progress", "Done"].includes(status))
      return res.status(400).json({ message: "Invalid status value" });

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // Regular users can only update status on tasks assigned to them
    const isAssignedUser = task.assignedTo?.toString() === req.user.id;
    const isAdmin        = req.user.role === "admin";
    if (!isAssignedUser && !isAdmin) {
      return res.status(403).json({ message: "Forbidden. You are not assigned to this task." });
    }

    task.status = status;
    await task.save();
    res.json(task);
  })
);

// PATCH /submit — assigned user submits work log and marks task Done
app.patch("/tasks/:id/submit",
  verifyToken,                 // 🔒 must be logged in
  asyncHandler(async (req, res) => {
    const { workLog } = req.body;
    if (!workLog?.trim()) return res.status(400).json({ message: "Work log cannot be empty" });

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // Only the assigned user (or admin) can submit
    const isAssignedUser = task.assignedTo?.toString() === req.user.id;
    const isAdmin        = req.user.role === "admin";
    if (!isAssignedUser && !isAdmin) {
      return res.status(403).json({ message: "Forbidden. You are not assigned to this task." });
    }

    task.workLog = workLog.trim();
    task.status  = "Done";
    await task.save();
    res.json(task);
  })
);

// POST /upload — assigned user uploads a file; admin can also upload
app.post("/tasks/:id/upload",
  verifyToken,                 // 🔒 must be logged in
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file provided" });

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // Only the assigned user (or admin) can upload files
    const isAssignedUser = task.assignedTo?.toString() === req.user.id;
    const isAdmin        = req.user.role === "admin";
    if (!isAssignedUser && !isAdmin) {
      return res.status(403).json({ message: "Forbidden. You are not assigned to this task." });
    }

    const fileEntry = {
      filename:     req.file.filename,
      originalname: req.file.originalname,
      mimetype:     req.file.mimetype,
      size:         req.file.size,
    };
    task.attachments.push(fileEntry);
    await task.save();
    res.json({ message: "File uploaded successfully", file: fileEntry });
  })
);

// DELETE — admin only: delete task
app.delete("/tasks/:id",
  verifyToken, requireAdmin,   // 🔒 admin only
  asyncHandler(async (req, res) => {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json({ message: "Task deleted" });
  })
);

/* ═══════════════════════════════════════════════════════════════════
   404 — Route not found
═══════════════════════════════════════════════════════════════════ */
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

/* ═══════════════════════════════════════════════════════════════════
   GLOBAL ERROR HANDLER
═══════════════════════════════════════════════════════════════════ */
app.use((err, req, res, next) => {
  console.error(`❌ [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.error(`   ${err.stack || err.message}`);

  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(413).json({ message: `File too large. Max size is ${MAX_FILE_SIZE_MB}MB.` });

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(", ") });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(400).json({ message: `${field} already exists` });
  }

  if (err.name === "CastError")
    return res.status(400).json({ message: `Invalid ID format: ${err.value}` });

  if (err.name === "JsonWebTokenError")
    return res.status(401).json({ message: "Invalid token" });

  if (err.name === "TokenExpiredError")
    return res.status(401).json({ message: "Token expired. Please log in again." });

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

/* ═══════════════════════════════════════════════════════════════════
   UNHANDLED REJECTIONS & EXCEPTIONS
═══════════════════════════════════════════════════════════════════ */
process.on("unhandledRejection", (reason) =>
  console.error("❌ Unhandled Rejection:", reason)
);
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  process.exit(1);
});

/* ═══════════════════════════════════════════════════════════════════
   START SERVER
═══════════════════════════════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🌍 Allowed origin : ${CLIENT_ORIGIN}`);
});
