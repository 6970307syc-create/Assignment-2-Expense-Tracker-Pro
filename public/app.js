const API = '/api';
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const statusEl = document.getElementById('status');
const currentUserEl = document.getElementById('current-user');
const adminTab = document.getElementById('admin-tab');
const panels = {
  expenses: document.getElementById('expenses-panel'),
  profile: document.getElementById('profile-panel'),
  admin: document.getElementById('admin-panel')
};

const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  categories: [],
  expenses: [],
  users: [],
  activities: [],
  editingExpenseId: null,
  editingUserId: null,
  editingActivityId: null,
  activeTab: 'expenses',
  expenseSearch: '',
  expenseCategory: '',
  activitySearch: ''
};

const formatMoney = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

const setStatus = (message, isError = false) => {
  statusEl.textContent = message || '';
  statusEl.classList.toggle('error', isError);
  const authStatus = document.getElementById('auth-status');
  if (authStatus) {
    authStatus.textContent = message || '';
    authStatus.classList.toggle('error', isError);
  }
};

const api = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (res.status === 401) {
    signOut(false);
    throw new Error(body?.message || 'Please sign in again.');
  }

  if (!res.ok) throw new Error(body?.message || 'Request failed');
  return body;
};

const persistSession = ({ token, user }) => {
  state.token = token;
  state.user = user;
  state.activeTab = 'expenses';
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

const signOut = async (notifyServer = true) => {
  if (notifyServer && state.token) {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  state.token = null;
  state.user = null;
  state.expenses = [];
  state.activeTab = 'expenses';
  render();
};

const categoryOptions = (selected = '') =>
  state.categories.map((category) => `<option value="${category}" ${category === selected ? 'selected' : ''}>${category}</option>`).join('');

const renderAuth = () => {
  authView.innerHTML = `
    <div class="auth-card">
      <div>
        <p class="eyebrow">Assignment 2</p>
        <h1>Expense Control</h1>
        <p class="muted">Track expenses, search instantly, and let admins manage users and activity records from one single-page interface.</p>
      </div>
      <form id="login-form" class="stack">
        <h2>Sign in</h2>
        <label>Email<input type="email" name="email" placeholder="admin@example.com" required /></label>
        <label>Password<input type="password" name="password" placeholder="Enter password" required /></label>
        <button type="submit">Sign in</button>
        <p id="auth-status" class="status" aria-live="polite"></p>
      </form>
      <form id="register-form" class="stack subtle-box">
        <h2>Create account</h2>
        <label>Name<input type="text" name="name" required /></label>
        <label>Email<input type="email" name="email" required /></label>
        <label>Password<input type="password" name="password" minlength="6" required /></label>
        <button type="submit" class="secondary">Register</button>
      </form>
    </div>
  `;
};

const renderExpensePanel = () => {
  const visible = state.expenses.filter((expense) => {
    const text = `${expense.title} ${expense.category} ${expense.description || ''}`.toLowerCase();
    return text.includes(state.expenseSearch.toLowerCase()) && (!state.expenseCategory || expense.category === state.expenseCategory);
  });
  const totals = visible.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const byCategory = visible.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0);
    return acc;
  }, {});

  panels.expenses.innerHTML = `
    <div class="metrics">
      <div><span>Total shown</span><strong>${formatMoney(totals)}</strong></div>
      <div><span>Items</span><strong>${visible.length}</strong></div>
      <div><span>Monthly budget</span><strong>${formatMoney(state.user?.monthlyBudget)}</strong></div>
    </div>
    <div class="layout">
      <form id="expense-form" class="surface stack">
        <h2>${state.editingExpenseId ? 'Edit expense' : 'Add expense'}</h2>
        <label>Title<input type="text" name="title" required /></label>
        <div class="form-grid">
          <label>Category<select name="category" required>${categoryOptions()}</select></label>
          <label>Amount<input type="number" name="amount" min="0" step="0.01" required /></label>
          <label>Date<input type="date" name="date" required /></label>
        </div>
        <label>Description<textarea name="description" rows="3" placeholder="Optional note"></textarea></label>
        <div class="actions">
          <button type="submit">${state.editingExpenseId ? 'Update' : 'Save'} expense</button>
          <button type="button" id="cancel-expense-edit" class="secondary ${state.editingExpenseId ? '' : 'hidden'}">Cancel</button>
        </div>
      </form>
      <div class="surface stack">
        <div class="toolbar">
          <label>Live search<input type="search" id="expense-search" value="${escapeHtml(state.expenseSearch)}" placeholder="Search title, category, notes" /></label>
          <label>Category<select id="expense-filter"><option value="">All categories</option>${categoryOptions(state.expenseCategory)}</select></label>
        </div>
        <div id="expense-list" class="list">
          ${
            visible.length
              ? visible
                  .map(
                    (expense) => `
              <article class="item">
                <div class="item-top">
                  <strong>${escapeHtml(expense.title)}</strong>
                  <span>${formatMoney(expense.amount)}</span>
                </div>
                <div class="item-meta">
                  <span class="badge">${escapeHtml(expense.category)}</span>
                  <small>${new Date(expense.date).toLocaleDateString()}</small>
                  ${expense.user ? `<small>${escapeHtml(expense.user.name)}</small>` : ''}
                </div>
                <p>${escapeHtml(expense.description || 'No description')}</p>
                <div class="item-actions">
                  <button type="button" data-action="edit-expense" data-id="${expense._id}">Edit</button>
                  <button type="button" class="danger" data-action="delete-expense" data-id="${expense._id}">Delete</button>
                </div>
              </article>`
                  )
                  .join('')
              : '<p class="empty">No matching expenses.</p>'
          }
        </div>
        <div class="summary">
          ${Object.keys(byCategory).length ? Object.entries(byCategory).map(([name, total]) => `<span>${name}: ${formatMoney(total)}</span>`).join('') : '<span>No category data yet.</span>'}
        </div>
      </div>
    </div>
  `;

  const editing = state.expenses.find((expense) => expense._id === state.editingExpenseId);
  if (editing) {
    const form = document.getElementById('expense-form');
    form.title.value = editing.title;
    form.category.value = editing.category;
    form.amount.value = editing.amount;
    form.date.value = new Date(editing.date).toISOString().split('T')[0];
    form.description.value = editing.description || '';
  }
};

const renderProfilePanel = () => {
  panels.profile.innerHTML = `
    <form id="profile-form" class="surface stack narrow">
      <h2>Profile</h2>
      <label>Name<input type="text" name="name" value="${escapeHtml(state.user?.name)}" required /></label>
      <label>Email<input type="email" value="${escapeHtml(state.user?.email)}" disabled /></label>
      <label>Monthly budget<input type="number" name="monthlyBudget" min="0" step="0.01" value="${Number(state.user?.monthlyBudget || 0)}" /></label>
      <button type="submit">Update profile</button>
    </form>
  `;
};

const renderAdminPanel = () => {
  const users = state.users;
  const activities = state.activities.filter((activity) => {
    const text = `${activity.action} ${activity.entity} ${activity.details || ''} ${activity.note || ''} ${activity.user?.email || ''}`.toLowerCase();
    return text.includes(state.activitySearch.toLowerCase());
  });

  panels.admin.innerHTML = `
    <div class="layout">
      <form id="user-form" class="surface stack">
        <h2>${state.editingUserId ? 'Edit user' : 'Create user'}</h2>
        <label>Name<input type="text" name="name" required /></label>
        <label>Email<input type="email" name="email" required /></label>
        <div class="form-grid">
          <label>Role<select name="role"><option value="user">User</option><option value="admin">Admin</option></select></label>
          <label>Budget<input type="number" name="monthlyBudget" min="0" step="0.01" value="0" /></label>
        </div>
        <label>Password<input type="password" name="password" minlength="6" placeholder="${state.editingUserId ? 'Leave blank to keep current' : 'At least 6 characters'}" ${state.editingUserId ? '' : 'required'} /></label>
        <label class="checkbox"><input type="checkbox" name="isActive" checked /> Active account</label>
        <div class="actions">
          <button type="submit">${state.editingUserId ? 'Update' : 'Create'} user</button>
          <button type="button" id="cancel-user-edit" class="secondary ${state.editingUserId ? '' : 'hidden'}">Cancel</button>
        </div>
      </form>
      <section class="surface stack">
        <h2>User accounts</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${users
                .map(
                  (user) => `
                <tr>
                  <td>${escapeHtml(user.name)}</td>
                  <td>${escapeHtml(user.email)}</td>
                  <td>${user.role}</td>
                  <td>${user.isActive ? 'Active' : 'Disabled'}</td>
                  <td class="row-actions">
                    <button type="button" data-action="edit-user" data-id="${user._id}">Edit</button>
                    <button type="button" class="danger" data-action="delete-user" data-id="${user._id}" ${user._id === state.user._id ? 'disabled' : ''}>Delete</button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <div class="layout activity-layout">
      <form id="activity-form" class="surface stack">
        <h2>${state.editingActivityId ? 'Edit activity' : 'Add admin note'}</h2>
        <label>Action<input type="text" name="action" value="admin_note" required /></label>
        <label>Details<input type="text" name="details" required /></label>
        <label>Note<textarea name="note" rows="3"></textarea></label>
        <div class="actions">
          <button type="submit">${state.editingActivityId ? 'Update' : 'Save'} activity</button>
          <button type="button" id="cancel-activity-edit" class="secondary ${state.editingActivityId ? '' : 'hidden'}">Cancel</button>
        </div>
      </form>
      <section class="surface stack">
        <div class="toolbar">
          <h2>Activity log</h2>
          <label>Live search<input type="search" id="activity-search" value="${escapeHtml(state.activitySearch)}" placeholder="Search activities" /></label>
        </div>
        <div class="list compact-list">
          ${
            activities.length
              ? activities
                  .map(
                    (activity) => `
              <article class="item">
                <div class="item-top"><strong>${escapeHtml(activity.action)}</strong><span>${escapeHtml(activity.entity)}</span></div>
                <p>${escapeHtml(activity.details || 'No details')}</p>
                <small>${escapeHtml(activity.user?.email || 'System')} - ${new Date(activity.createdAt).toLocaleString()}</small>
                ${activity.note ? `<small>Note: ${escapeHtml(activity.note)}</small>` : ''}
                <div class="item-actions">
                  <button type="button" data-action="edit-activity" data-id="${activity._id}">Edit</button>
                  <button type="button" class="danger" data-action="delete-activity" data-id="${activity._id}">Delete</button>
                </div>
              </article>`
                  )
                  .join('')
              : '<p class="empty">No matching activities.</p>'
          }
        </div>
      </section>
    </div>
  `;

  const editingUser = users.find((user) => user._id === state.editingUserId);
  if (editingUser) {
    const form = document.getElementById('user-form');
    form.name.value = editingUser.name;
    form.email.value = editingUser.email;
    form.role.value = editingUser.role;
    form.monthlyBudget.value = editingUser.monthlyBudget || 0;
    form.isActive.checked = editingUser.isActive;
  }

  const editingActivity = state.activities.find((activity) => activity._id === state.editingActivityId);
  if (editingActivity) {
    const form = document.getElementById('activity-form');
    form.action.value = editingActivity.action;
    form.details.value = editingActivity.details;
    form.note.value = editingActivity.note || '';
  }
};

const render = () => {
  if (!state.token || !state.user) {
    authView.classList.remove('hidden');
    appView.classList.add('hidden');
    renderAuth();
    return;
  }

  authView.classList.add('hidden');
  appView.classList.remove('hidden');
  if (state.user.role !== 'admin' && state.activeTab === 'admin') {
    state.activeTab = 'expenses';
  }
  currentUserEl.textContent = `${state.user.name} (${state.user.role})`;
  adminTab.classList.toggle('hidden', state.user.role !== 'admin');

  Object.entries(panels).forEach(([name, panel]) => panel.classList.toggle('hidden', name !== state.activeTab));
  document.querySelectorAll('.tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === state.activeTab));

  renderExpensePanel();
  renderProfilePanel();
  if (state.user.role === 'admin') renderAdminPanel();
};

const refreshExpenses = async () => {
  state.expenses = await api('/expenses');
};

const refreshAdmin = async () => {
  if (state.user?.role !== 'admin') return;
  const [users, activities] = await Promise.all([api('/users'), api('/activities')]);
  state.users = users;
  state.activities = activities;
};

const refreshAll = async () => {
  try {
    state.categories = (await api('/config')).categories;
    await refreshExpenses();
    await refreshAdmin();
    render();
    setStatus('Data loaded.');
  } catch (error) {
    setStatus(`${error.message} Use the buttons again after the connection is restored.`, true);
  }
};

document.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    if (form.id === 'login-form') {
      persistSession(await api('/auth/login', { method: 'POST', body: JSON.stringify(data) }));
      await refreshAll();
      return;
    }

    if (form.id === 'register-form') {
      persistSession(await api('/auth/register', { method: 'POST', body: JSON.stringify(data) }));
      await refreshAll();
      return;
    }

    if (form.id === 'expense-form') {
      const payload = { ...data, amount: Number(data.amount) };
      const path = state.editingExpenseId ? `/expenses/${state.editingExpenseId}` : '/expenses';
      const method = state.editingExpenseId ? 'PUT' : 'POST';
      await api(path, { method, body: JSON.stringify(payload) });
      state.editingExpenseId = null;
      await refreshExpenses();
      render();
      setStatus(method === 'PUT' ? 'Expense updated.' : 'Expense created.');
    }

    if (form.id === 'profile-form') {
      state.user = await api('/me', { method: 'PUT', body: JSON.stringify({ name: data.name, monthlyBudget: Number(data.monthlyBudget) }) });
      localStorage.setItem('user', JSON.stringify(state.user));
      render();
      setStatus('Profile updated.');
    }

    if (form.id === 'user-form') {
      const payload = {
        ...data,
        monthlyBudget: Number(data.monthlyBudget || 0),
        isActive: Boolean(data.isActive)
      };
      const path = state.editingUserId ? `/users/${state.editingUserId}` : '/users';
      const method = state.editingUserId ? 'PUT' : 'POST';
      await api(path, { method, body: JSON.stringify(payload) });
      state.editingUserId = null;
      await refreshAdmin();
      render();
      setStatus(method === 'PUT' ? 'User updated.' : 'User created.');
    }

    if (form.id === 'activity-form') {
      const path = state.editingActivityId ? `/activities/${state.editingActivityId}` : '/activities';
      const method = state.editingActivityId ? 'PUT' : 'POST';
      await api(path, { method, body: JSON.stringify(data) });
      state.editingActivityId = null;
      await refreshAdmin();
      render();
      setStatus(method === 'PUT' ? 'Activity updated.' : 'Activity note created.');
    }
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'expense-search') {
    const cursorPosition = event.target.selectionStart;
    state.expenseSearch = event.target.value;
    renderExpensePanel();
    const searchInput = document.getElementById('expense-search');
    searchInput?.focus();
    searchInput?.setSelectionRange(cursorPosition, cursorPosition);
  }
  if (event.target.id === 'activity-search') {
    const cursorPosition = event.target.selectionStart;
    state.activitySearch = event.target.value;
    renderAdminPanel();
    const searchInput = document.getElementById('activity-search');
    searchInput?.focus();
    searchInput?.setSelectionRange(cursorPosition, cursorPosition);
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'expense-filter') {
    state.expenseCategory = event.target.value;
    renderExpensePanel();
  }
});

document.addEventListener('click', async (event) => {
  const tabButton = event.target.closest('.tabs button[data-tab]');
  if (tabButton) {
    state.activeTab = tabButton.dataset.tab;
    render();
    return;
  }

  if (event.target.id === 'logout-btn') {
    await signOut(true);
    return;
  }

  if (event.target.id === 'cancel-expense-edit') {
    state.editingExpenseId = null;
    render();
    return;
  }

  if (event.target.id === 'cancel-user-edit') {
    state.editingUserId = null;
    render();
    return;
  }

  if (event.target.id === 'cancel-activity-edit') {
    state.editingActivityId = null;
    render();
    return;
  }

  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;

  const { action, id } = actionButton.dataset;

  try {
    if (action === 'edit-expense') {
      state.editingExpenseId = id;
      render();
      document.getElementById('expense-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (action === 'delete-expense') {
      const expense = state.expenses.find((item) => item._id === id);
      if (!confirm(`Delete "${expense?.title || 'this expense'}"? This cannot be undone.`)) return;
      await api(`/expenses/${id}`, { method: 'DELETE' });
      await refreshExpenses();
      render();
      setStatus('Expense deleted.');
    }

    if (action === 'edit-user') {
      state.editingUserId = id;
      renderAdminPanel();
      document.getElementById('user-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (action === 'delete-user') {
      const user = state.users.find((item) => item._id === id);
      if (!confirm(`Delete account "${user?.email}" and its expenses?`)) return;
      await api(`/users/${id}`, { method: 'DELETE' });
      await refreshAdmin();
      render();
      setStatus('User deleted.');
    }

    if (action === 'edit-activity') {
      state.editingActivityId = id;
      renderAdminPanel();
      document.getElementById('activity-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (action === 'delete-activity') {
      if (!confirm('Delete this activity record?')) return;
      await api(`/activities/${id}`, { method: 'DELETE' });
      await refreshAdmin();
      render();
      setStatus('Activity deleted.');
    }
  } catch (error) {
    setStatus(error.message, true);
  }
});

render();
if (state.token) refreshAll();
