## How It Works

This is an LLM-powered dispute resolution app. Think of it as a tool for interpersonal problem solving, or "AITA"-style moral reasoning.  The idea is that the bot can serve as a good-enough "trusted arbiter." Hopefully, parties to a dispute can agree to abide by, or at least give some credence to, the bot's judgment, after it's "heard" everyone's side of the story. 

Structurally, a "dispute" has two or more participants, each of whom submits text (representing their side of the story.) Dispute participants can only see their own text. When all participants have submitted text, an LLM will use the text to generate a "verdict" (an assessment of who, if anyone, is in the right or in the wrong, and what should be done about the problem now.) All participants will see the verdict, and the dispute will be marked complete. 

Warning: Please be careful about putting private information on the app. 
The database is encrypted but I do store the encryption keys as environment variables; i.e. *in principle* I would be able to access your username, email address, and dispute contents. I have no intention of doing this. But just to be safe, please don't input any real personal information that you'd be uncomfortable with a stranger seeing. 

## Download Instructions

### Web Browser
Go to https://fairenough.netlify.app/ to use the app

### iOS

1. Go to https://fairenough.netlify.app/ in Safari
2. Tap the "share" button (square with arrow)
3. Scroll down and tap "add to home screen"

### Android

1. Go to https://expo.dev/accounts/srconstantin/projects/fairenough/builds/c327c8cb-1e13-428e-b30c-f80707f584c0 to download the app


## Local Setup Instructions

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

--shows error and success messages to users

--saves login and current page state (so reloads don't logout or redirect the user)

## TODO


--allow deleting contacts

--require contact requests/contacts to be unique

--allow creators to delete disputes and participants to leave disputes

--show a FairEnough title/logo in browser tabs

--(maybe) show all participants' accounts of a dispute to all participants.


This is a work in progress, with heavy assistance from Claude (Sonnet 4).


