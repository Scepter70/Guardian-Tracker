# 🛡️ Guardian Tracker

A full-stack **Device Tracking & Anti-Theft** system.

## Features

- User Registration & Login (JWT + bcrypt)
- Register multiple devices
- Real-time location updates (Socket.io)
- Mark device as Stolen / Recovered
- Location history
- Clean and simple frontend

## Tech Stack

- **Backend**: Node.js, Express, MongoDB, Socket.io, JWT, bcrypt
- **Frontend**: HTML + Vanilla JavaScript

## Project Structure

```
guardian-tracker/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   └── index.html
└── README.md
```

## How to Run Locally

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env if needed
npm start
```

Server will run on: http://localhost:5000

### 2. Frontend

Open `frontend/index.html` in your browser  
(or use any live server).

> Remember to change the `API` variable inside `index.html` if you deploy the backend.

## API Endpoints

| Method | Endpoint                          | Description                | Auth |
|--------|-----------------------------------|----------------------------|------|
| POST   | /api/register                     | Create account             | No   |
| POST   | /api/login                        | Login                      | No   |
| POST   | /api/devices                      | Register device            | Yes  |
| GET    | /api/devices                      | Get my devices             | Yes  |
| POST   | /api/devices/:id/location         | Update location            | Yes  |
| PUT    | /api/devices/:id/stolen           | Mark stolen / recovered    | Yes  |
| DELETE | /api/devices/:id                  | Delete device              | Yes  |

## Deployment

### Backend (Render / Railway / Vercel)
1. Push this repo to GitHub
2. Create a new Web Service
3. Set environment variables:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `PORT`
4. Start command: `node backend/server.js`

### Frontend
You can deploy the `frontend` folder to Vercel, Netlify, or GitHub Pages.

## Author

**Chetachukwu Sixtus Obiorah**  
GitHub: [Scepter70](https://github.com/Scepter70)

---

© 2026 Chetachukwu Sixtus Obiorah. All Rights Reserved.
