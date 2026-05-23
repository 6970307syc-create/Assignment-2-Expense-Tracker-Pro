const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker_plus';
const JWT_SECRET = process.env.JWT_SECRET || 'development-only-change-me';
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Housing', 'Utilities', 'Study', 'Health', 'Entertainment', 'Other'];

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    monthlyBudget: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const expenseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, enum: EXPENSE_CATEGORIES },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    description: { type: String, default: '', trim: true, maxlength: 400 }
  },
  { timestamps: true }
);

const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true, trim: true },
    entity: { type: String, required: true, enum: ['auth', 'expense', 'user', 'activity'] },
    entityId: { type: String, default: '' },
    details: { type: String, default: '', trim: true, maxlength: 500 },
    note: { type: String, default: '', trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const Expense = mongoose.model('Expense', expenseSchema);
const UserActivity = mongoose.model('UserActivity', activitySchema);

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const cleanUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  monthlyBudget: user.monthlyBudget,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const createToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: '8h' });

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const logActivity = async ({ user, action, entity, entityId = '', details = '', note = '' }) => {
  await UserActivity.create({
    user: user || undefined,
    action,
    entity,
    entityId,
    details,
    note
  });
};

const validatePassword = (password) => {
  if (!password || password.length < 6) return 'password must be at least 6 characters';
  return null;
};

const validateExpensePayload = (payload) => {
  const required = ['title', 'category', 'amount', 'date'];
  for (const key of required) {
    if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
      return `${key} is required`;
    }
  }

  if (!EXPENSE_CATEGORIES.includes(payload.category)) {
    return 'category must be selected from the approved list';
  }

  if (Number(payload.amount) < 0 || Number.isNaN(Number(payload.amount))) {
    return 'amount must be a non-negative number';
  }

  if (Number.isNaN(new Date(payload.date).getTime())) {
    return 'date must be a valid date';
  }

  return null;
};

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (_error) {
    return res.status(401).json({ message: 'Session expired. Please sign in again.' });
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'Account is unavailable' });
  }

  req.user = user;
  next();
});

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

const expenseScope = (req) => {
  if (req.user.role === 'admin' && req.query.userId && isObjectId(req.query.userId)) {
    return { user: new mongoose.Types.ObjectId(req.query.userId) };
  }
  if (req.user.role === 'admin' && req.query.all === 'true') return {};
  return { user: req.user._id };
};

app.get('/api/config', (_req, res) => {
  res.json({ categories: EXPENSE_CATEGORIES });
});

app.post(
  '/api/auth/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'name and email are required' });

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: 'Email is already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role: 'user' });
    await logActivity({ user: user._id, action: 'register', entity: 'auth', details: `${user.email} registered` });

    res.status(201).json({ token: createToken(user), user: cleanUser(user) });
  })
);

app.post(
  '/api/auth/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase().trim() });
    if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password || '', user.passwordHash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    await logActivity({ user: user._id, action: 'login', entity: 'auth', details: `${user.email} signed in` });
    res.json({ token: createToken(user), user: cleanUser(user) });
  })
);

app.post(
  '/api/auth/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    await logActivity({ user: req.user._id, action: 'logout', entity: 'auth', details: `${req.user.email} signed out` });
    res.status(204).send();
  })
);

app.get('/api/me', requireAuth, (req, res) => {
  res.json(cleanUser(req.user));
});

app.put(
  '/api/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const updates = {
      name: req.body.name,
      monthlyBudget: Number(req.body.monthlyBudget || 0)
    };
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    await logActivity({ user: req.user._id, action: 'update_profile', entity: 'user', entityId: req.user._id, details: 'Updated own profile' });
    res.json(cleanUser(user));
  })
);

app.get(
  '/api/expenses',
  requireAuth,
  asyncHandler(async (req, res) => {
    const scope = expenseScope(req);
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const filter = { ...scope };

    if (category && EXPENSE_CATEGORIES.includes(category)) filter.category = category;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const expenses = await Expense.find(filter).populate('user', 'name email').sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  })
);

app.post(
  '/api/expenses',
  requireAuth,
  asyncHandler(async (req, res) => {
    const validationError = validateExpensePayload(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const expense = await Expense.create({
      user: req.user._id,
      title: req.body.title,
      category: req.body.category,
      amount: Number(req.body.amount),
      date: req.body.date,
      description: req.body.description || ''
    });
    await logActivity({ user: req.user._id, action: 'create_expense', entity: 'expense', entityId: expense._id, details: expense.title });
    res.status(201).json(expense);
  })
);

app.put(
  '/api/expenses/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid expense id' });

    const validationError = validateExpensePayload(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const existing = await Expense.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Expense not found' });
    if (req.user.role !== 'admin' && existing.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own expenses' });
    }

    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title,
        category: req.body.category,
        amount: Number(req.body.amount),
        date: req.body.date,
        description: req.body.description || ''
      },
      { new: true, runValidators: true }
    );
    await logActivity({ user: req.user._id, action: 'update_expense', entity: 'expense', entityId: expense._id, details: expense.title });
    res.json(expense);
  })
);

app.delete(
  '/api/expenses/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid expense id' });

    const existing = await Expense.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Expense not found' });
    if (req.user.role !== 'admin' && existing.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own expenses' });
    }

    await Expense.findByIdAndDelete(req.params.id);
    await logActivity({ user: req.user._id, action: 'delete_expense', entity: 'expense', entityId: req.params.id, details: existing.title });
    res.status(204).send();
  })
);

app.get(
  '/api/summary/by-category',
  requireAuth,
  asyncHandler(async (req, res) => {
    const summary = await Expense.aggregate([
      { $match: expenseScope(req) },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);
    res.json(summary);
  })
);

app.get(
  '/api/summary/monthly',
  requireAuth,
  asyncHandler(async (req, res) => {
    const summary = await Expense.aggregate([
      { $match: expenseScope(req) },
      { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, total: { $sum: '$amount' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    res.json(summary);
  })
);

app.get(
  '/api/users',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users.map(cleanUser));
  })
);

app.post(
  '/api/users',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, email, password, role = 'user', monthlyBudget = 0, isActive = true } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'name and email are required' });
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role, monthlyBudget, isActive });
    await logActivity({ user: req.user._id, action: 'create_user', entity: 'user', entityId: user._id, details: user.email });
    res.status(201).json(cleanUser(user));
  })
);

app.put(
  '/api/users/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user id' });

    const updates = {
      name: req.body.name,
      email: req.body.email,
      role: req.body.role,
      monthlyBudget: Number(req.body.monthlyBudget || 0),
      isActive: Boolean(req.body.isActive)
    };
    if (req.body.password) {
      const passwordError = validatePassword(req.body.password);
      if (passwordError) return res.status(400).json({ message: passwordError });
      updates.passwordHash = await bcrypt.hash(req.body.password, 12);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    await logActivity({ user: req.user._id, action: 'update_user', entity: 'user', entityId: user._id, details: user.email });
    res.json(cleanUser(user));
  })
);

app.delete(
  '/api/users/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user id' });
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ message: 'You cannot delete your own account' });

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await Expense.deleteMany({ user: user._id });
    await logActivity({ user: req.user._id, action: 'delete_user', entity: 'user', entityId: req.params.id, details: user.email });
    res.status(204).send();
  })
);

app.get(
  '/api/activities',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || '').trim();
    const filter = search
      ? {
          $or: [
            { action: { $regex: search, $options: 'i' } },
            { entity: { $regex: search, $options: 'i' } },
            { details: { $regex: search, $options: 'i' } },
            { note: { $regex: search, $options: 'i' } }
          ]
        }
      : {};
    const activities = await UserActivity.find(filter).populate('user', 'name email').sort({ createdAt: -1 }).limit(100);
    res.json(activities);
  })
);

app.post(
  '/api/activities',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const activity = await UserActivity.create({
      user: req.user._id,
      action: req.body.action || 'admin_note',
      entity: 'activity',
      details: req.body.details || 'Manual activity note',
      note: req.body.note || ''
    });
    res.status(201).json(activity);
  })
);

app.put(
  '/api/activities/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid activity id' });
    const activity = await UserActivity.findByIdAndUpdate(
      req.params.id,
      { action: req.body.action, details: req.body.details, note: req.body.note },
      { new: true, runValidators: true }
    );
    if (!activity) return res.status(404).json({ message: 'Activity not found' });
    res.json(activity);
  })
);

app.delete(
  '/api/activities/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid activity id' });
    const activity = await UserActivity.findByIdAndDelete(req.params.id);
    if (!activity) return res.status(404).json({ message: 'Activity not found' });
    res.status(204).send();
  })
);

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, _req, res, _next) => {
  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors).map((item) => item.message).join(', ');
    return res.status(400).json({ message });
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: 'A record with that unique value already exists' });
  }

  console.error(error);
  return res.status(500).json({ message: 'Server error. Please try again shortly.' });
});

const seedAdmin = async () => {
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) return;

  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await User.create({ name: 'Default Admin', email, passwordHash, role: 'admin', monthlyBudget: 2500 });
  await logActivity({ user: admin._id, action: 'seed_admin', entity: 'user', entityId: admin._id, details: `Created ${email}` });
  console.log(`Seeded admin account: ${email} / ${password}`);
};

const startServer = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    await seedAdmin();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
