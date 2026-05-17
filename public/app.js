const API = '/api';
const form = document.getElementById('expense-form');
const list = document.getElementById('expense-list');
const statusEl = document.getElementById('status');
const categorySummaryEl = document.getElementById('category-summary');
const monthlySummaryEl = document.getElementById('monthly-summary');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');

let editingId = null;

const formatMoney = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const setStatus = (message, isError = false) => {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#c62828' : '#64748b';
};

const resetFormMode = () => {
  editingId = null;
  form.reset();
  formTitle.textContent = 'Add Expense';
  submitBtn.textContent = 'Save Expense';
  cancelBtn.classList.add('hidden');
};

const loadExpenses = async () => {
  const res = await fetch(`${API}/expenses`);
  if (!res.ok) throw new Error('Failed to load expenses');
  return res.json();
};

const loadSummary = async () => {
  const [categoryRes, monthlyRes] = await Promise.all([
    fetch(`${API}/summary/by-category`),
    fetch(`${API}/summary/monthly`)
  ]);

  if (!categoryRes.ok || !monthlyRes.ok) {
    throw new Error('Failed to load summaries');
  }

  return {
    byCategory: await categoryRes.json(),
    monthly: await monthlyRes.json()
  };
};

const renderSummary = ({ byCategory, monthly }) => {
  categorySummaryEl.innerHTML = byCategory.length
    ? byCategory
        .map((x) => `<li>${x._id}: ${formatMoney(x.total)} (${x.count} items)</li>`)
        .join('')
    : '<li>No expenses yet.</li>';

  monthlySummaryEl.innerHTML = monthly.length
    ? monthly
        .map((x) => `<li>${x._id.year}-${String(x._id.month).padStart(2, '0')}: ${formatMoney(x.total)}</li>`)
        .join('')
    : '<li>No monthly data yet.</li>';
};

const renderExpenses = (expenses) => {
  if (!expenses.length) {
    list.innerHTML = '<p>No expense items yet. Add one to get started.</p>';
    return;
  }

  list.innerHTML = expenses
    .map(
      (expense) => `
      <article class="item">
        <div class="item-top">
          <strong>${expense.title}</strong>
          <span>${formatMoney(expense.amount)}</span>
        </div>
        <div>
          <span class="badge">${expense.category}</span>
          <small> ${new Date(expense.date).toLocaleDateString()}</small>
        </div>
        <small>${expense.description || ''}</small>
        <div class="item-actions">
          <button type="button" data-action="edit" data-id="${expense._id}">Edit</button>
          <button type="button" class="danger" data-action="delete" data-id="${expense._id}">Delete</button>
        </div>
      </article>
    `
    )
    .join('');
};

const refresh = async () => {
  try {
    const [expenses, summary] = await Promise.all([loadExpenses(), loadSummary()]);
    renderExpenses(expenses);
    renderSummary(summary);
    setStatus(`Loaded ${expenses.length} expense item(s).`);
  } catch (error) {
    setStatus(error.message, true);
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    title: formData.get('title')?.trim(),
    category: formData.get('category')?.trim(),
    amount: Number(formData.get('amount')),
    date: formData.get('date'),
    description: formData.get('description')?.trim()
  };

  const endpoint = editingId ? `${API}/expenses/${editingId}` : `${API}/expenses`;
  const method = editingId ? 'PUT' : 'POST';

  try {
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const body = res.status === 204 ? null : await res.json();
    if (!res.ok) throw new Error(body?.message || 'Request failed');

    setStatus(editingId ? 'Expense updated.' : 'Expense created.');
    resetFormMode();
    await refresh();
  } catch (error) {
    setStatus(error.message, true);
  }
});

cancelBtn.addEventListener('click', resetFormMode);

list.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === 'delete') {
    try {
      const res = await fetch(`${API}/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const body = await res.json();
        throw new Error(body.message || 'Delete failed');
      }
      setStatus('Expense deleted.');
      await refresh();
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  if (action === 'edit') {
    try {
      const expenses = await loadExpenses();
      const expense = expenses.find((x) => x._id === id);
      if (!expense) throw new Error('Expense not found');

      editingId = id;
      form.title.value = expense.title;
      form.category.value = expense.category;
      form.amount.value = expense.amount;
      form.date.value = new Date(expense.date).toISOString().split('T')[0];
      form.description.value = expense.description || '';

      formTitle.textContent = 'Edit Expense';
      submitBtn.textContent = 'Update Expense';
      cancelBtn.classList.remove('hidden');
      setStatus(`Editing "${expense.title}".`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }
});

refresh();
