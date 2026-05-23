# Assignment 2 Expense Tracker Pro

## 1) Project Title
**Expense Tracker Pro**

## 2) Project Description
This project is extended from my Assignment 1 expense tracker. The original version only allowed users to manage expense items. In this Assignment 2 version, I added user login, JWT authentication, admin functions, live search, and user activity records.

The website helps users record daily expenses and check spending summaries. Admin users can also manage user accounts and view activity records.

## 3) Technical Stack
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Node.js + Express
- **Database:** MongoDB + Mongoose
- **Authentication:** bcrypt password hashing + JWT
- **Interface:** Single-page application

## 4) Main Features
- Register and login with JWT authentication
- Passwords are stored with bcrypt hashing
- Add, view, edit, and delete expense records
- Live search for expense items
- Expense category dropdown
- User profile update
- Admin can create, edit, disable, and delete user accounts
- Admin can view, add, edit, and delete user activity records
- Delete confirmation and error messages
- Responsive layout for different screen sizes

## 5) Entity and CRUD Mapping
### User
- **Create:** register account or admin creates user
- **Read:** admin views all users
- **Update:** user updates profile or admin updates account
- **Delete:** admin deletes user account

### Expense
- **Create:** user adds expense
- **Read:** user views expense list and summaries
- **Update:** user edits expense
- **Delete:** user deletes expense

### User Activity
- **Create:** system creates activity logs, admin can add notes
- **Read:** admin views activity list
- **Update:** admin edits activity note/details
- **Delete:** admin deletes activity record

## 6) Single Page Application
The app uses one main page: `public/index.html`.
All interactions are handled by JavaScript and API requests, so the page does not need to reload or move to another HTML file.

## 7) Folder Structure
```text
.
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── data/
│   ├── sample-users.json
│   ├── sample-expenses.json
│   └── sample-activities.json
├── server.js
├── package.json
├── package-lock.json
├── .env.example
└── README.md
```

## 8) How to Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example`.
3. Make sure MongoDB is running.
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open:
   ```text
   http://localhost:3000
   ```

If the database is empty, the app creates a default admin account:

```text
Email: admin@example.com
Password: admin123
```

## 9) Workload Allocation
This is my individual assignment submission.

- **6970307syc-create:** `server.js`, `public/index.html`, `public/style.css`, `public/app.js`, `data/*.json`, `.env.example`, `package.json`, `README.md`

## 10) Notes
This Assignment 2 version is built on the Assignment 1 base. The main improvement is that the project now has three database entities, authentication, role-based admin features, and smoother frontend interaction.
