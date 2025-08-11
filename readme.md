## How It Works

This is an LLM-powered dispute resolution app. Think of it as a tool for interpersonal problem solving, or "AITA"-style moral reasoning.  The idea is that the bot can serve as a good-enough "trusted arbiter." Hopefully, parties to a dispute can agree to abide by, or at least give some credence to, the bot's judgment, after it's "heard" everyone's side of the story. 

Structurally, a "dispute" has two or more participants, each of whom submits text (representing their side of the story.) Dispute participants can only see their own text. When all participants have submitted text, an LLM will use the text to generate a "verdict" (an assessment of who, if anyone, is in the right or in the wrong, and what should be done about the problem now.) All participants will see the verdict, and the dispute will be marked complete. 

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

## What it does today
--signup, login, homepage, contacts

--allows users to make, accept, and reject contact requests

--saves user info and contact info to sqlite database

--allows users to make disputes, add contacts to disputes, accept or reject dispute invitations, and input text into a dispute. 


--saves disputes and their state (pending/accepted/rejected participants,  each participant's text, ongoing/cancelled/completed dispute status, dispute verdict) into the database

--uses participant text in a call to the Claude API to get a verdict on who's in the right/wrong and what should be done to resolve the dispute; saves the verdict to the database; and shows the users the verdict



## TODO
--Make more visually appealing (eg format the verdict correctly, size to fit the screen better, maybe pick a non-default font/color scheme)

--Send invite emails to invited contacts

--Switch to hosting on the cloud




This is a work in progress, with heavy assistance from Claude (Sonnet 4).
