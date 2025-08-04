# Simple Dispute App - Signup Only

This is the simplest version of the dispute app that only handles user signup.

## Setup Instructions

### Backend Setup
1. Navigate to backend folder: `cd backend`
2. Install dependencies: `npm install`
3. Start server: `npm run dev`
4. Server runs on http://localhost:3000

### Mobile Setup
1. Install Expo CLI: `npm install -g @expo/cli`
2. Navigate to mobile folder: `cd mobile`
3. Install dependencies: `npm install`
4. Start app: `npm start`
5. Use Expo Go app to scan QR code

## What it does
- Shows a signup form with name, email, password fields
- Validates input on both frontend and backend
- Hashes passwords before storing
- Creates user accounts in SQLite database
- Returns JWT token for authentication
- Shows success/error messages

## Next steps
- Add login functionality
- Add contact management
- Add dispute creation