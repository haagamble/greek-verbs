# Greek Verbs Quiz

A simple browser-based quiz app for practicing Greek verbs.

The app shows a Greek verb, asks the learner to choose the English meaning, and then offers sample sentences for speaking practice.

It currently includes 149 verbs organized across 20 levels, and over 850 sample sentences.

## Features

- Multiple-choice Greek verb quiz
- Level progression based on streaks
- Sample sentences for each verb
- Final-level mixed review
- Data stored in editable JSON files

## Core Files

- [index.html](/c:/Users/Heather502173/OneDrive%20-%20MSNPath/Projects/Greek%20vocab/greek-verbs-app/index.html) - app UI
- [style.css](/c:/Users/Heather502173/OneDrive%20-%20MSNPath/Projects/Greek%20vocab/greek-verbs-app/style.css) - app styling
- [script.js](/c:/Users/Heather502173/OneDrive%20-%20MSNPath/Projects/Greek%20vocab/greek-verbs-app/script.js) - quiz logic
- [server.js](/c:/Users/Heather502173/OneDrive%20-%20MSNPath/Projects/Greek%20vocab/greek-verbs-app/server.js) - simple local HTTP server
- [verbs.json](/c:/Users/Heather502173/OneDrive%20-%20MSNPath/Projects/Greek%20vocab/greek-verbs-app/verbs.json) - active verb data used by the app


## How It Works

The app loads `verbs.json` and uses the highest level number in that file as the final level.

Each verb entry includes:

- `id`
- `lemma`
- `english`
- `sentences`

Each sentence includes:

- `greek`
- `english`

The learner:

1. sees a Greek verb
2. chooses the English meaning
3. gets sample sentences after answering
4. levels up after 3 correct answers in a row
5. drops a level after a wrong answer

At the final level, the app starts mixing in verbs from other levels for review.

## Run Locally

Make sure Node.js is installed, then run:

```powershell
node server.js
```

Open:

```text
http://localhost:8000
```

To test on your phone, connect your phone to the same Wi-Fi network and open:

```text
http://YOUR-COMPUTER-IP:8000
```

Example:

```text
http://192.168.1.23:8000
```
