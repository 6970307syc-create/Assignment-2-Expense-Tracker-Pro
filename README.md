# Expense Tracker SPA - Assignment 1 Base

## 1) Project Title
**Expense Tracker SPA**

## 2) Project Description
This is the Assignment 1 base project for my expense tracker website. It is a single-page dynamic web application where users can add, view, update, and delete expense records with MongoDB as the database.

This repository is prepared as the clean starting version before extending the project for Assignment 2.

## 3) Technical Stack
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Node.js + Express
- **Database:** MongoDB + Mongoose
- **Routing:** Express API routes
- **Interface:** Single-page application behavior

## 4) Main Features
- Add new expense items
- View all expense records
- Edit existing expense records
- Delete expense records
- View spending summary by category
- View monthly spending trend
- Basic validation and status messages
- Responsive page layout

## 5) CRUD Mapping
- **Create:** `POST /api/expenses`
- **Read:** `GET /api/expenses`
- **Update:** `PUT /api/expenses/:id`
- **Delete:** `DELETE /api/expenses/:id`

## 6) Single Page Application
The project uses only one main HTML file: `public/index.html`.
All data changes are handled by JavaScript `fetch()` requests, and the page updates dynamically without loading another HTML page.

## 7) Folder Structure
```text
.
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── data/
│   └── sample-expenses.json
├── server.js
├── package.json
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
4. Start the server:
   ```bash
   npm run dev
   ```
5. Open:
   ```text
   http://localhost:3000
   ```

## 9) Database Export
Example data is included in `data/sample-expenses.json`.

## 10) Note
This is the clean Assignment 1 foundation. Assignment 2 will be built on top of this base by adding login, JWT authentication, user roles, live search, and more database entities.
