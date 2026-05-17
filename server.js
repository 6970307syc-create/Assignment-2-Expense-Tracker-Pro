const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    description: { type: String, default: '', trim: true }
  },
  { timestamps: true }
);

const Expense = mongoose.model('Expense', expenseSchema);

const validateExpensePayload = (payload) => {
  const required = ['title', 'category', 'amount', 'date'];
  for (const key of required) {
    if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
      return `${key} is required`;
    }
  }

  if (Number(payload.amount) < 0 || Number.isNaN(Number(payload.amount))) {
    return 'amount must be a non-negative number';
  }

  if (Number.isNaN(new Date(payload.date).getTime())) {
    return 'date must be a valid date';
  }

  return null;
};

app.get('/api/expenses', async (_req, res) => {
  const expenses = await Expense.find().sort({ date: -1, createdAt: -1 });
  res.json(expenses);
});

app.post('/api/expenses', async (req, res) => {
  const validationError = validateExpensePayload(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const expense = await Expense.create(req.body);
  return res.status(201).json(expense);
});

app.put('/api/expenses/:id', async (req, res) => {
  const validationError = validateExpensePayload(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!expense) {
    return res.status(404).json({ message: 'Expense not found' });
  }

  return res.json(expense);
});

app.delete('/api/expenses/:id', async (req, res) => {
  const deleted = await Expense.findByIdAndDelete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: 'Expense not found' });
  }

  return res.status(204).send();
});

app.get('/api/summary/by-category', async (_req, res) => {
  const summary = await Expense.aggregate([
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { total: -1 } }
  ]);

  res.json(summary);
});

app.get('/api/summary/monthly', async (_req, res) => {
  const summary = await Expense.aggregate([
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' }
        },
        total: { $sum: '$amount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  res.json(summary);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const startServer = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
