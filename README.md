# fantasyBatch

Node.js ingestion script that fetches football teams and player details from the SportMonks API and writes them into Firestore.

## What it does

- Reads teams for a configured season from SportMonks (`/teams/seasons/{SEASON_ID}` with `players` included)
- Fetches full player details for each player (`/players/{player_id}`)
- Writes team documents to `teams` collection in Firestore
- Writes player payloads to `players` collection in Firestore

Main script: `fantasyIngest.js`

## Requirements

- Node.js 20+ (ES modules + JSON module import syntax)
- A Firebase service account JSON key file
- A SportMonks API token
- Access to a Firestore project

## Setup

1. Install dependencies:

```bash
npm install
```

2. Ensure `serviceAccountKey.json` exists at the repo root (used by `fantasyIngest.js`).

3. Update configuration values in `fantasyIngest.js`:
- `API_TOKEN`
- `SEASON_ID`

## Run

```bash
node fantasyIngest.js
```

## Firestore collections written

- `teams/{teamId}`
- `players/{playerId}`

## Current notes

- `dotenv` is imported in `fantasyIngest.js`, but credentials/config are currently hardcoded in the file.
- There are no tests configured yet (`npm test` exits with an error by design).
