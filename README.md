# fantasyBatch

Node.js ingestion script that fetches football teams and player details from the SportMonks API and writes them into Firestore.

## What it does

- Reads teams for a configured season from SportMonks (`/teams/seasons/{SEASON_ID}` with `players` included)
- Fetches full player details for each player (`/players/{player_id}`)
- Writes team documents to `teams` collection in Firestore
- Writes player payloads to `players` collection in Firestore

Main script: `fantasyIngest.js`

## Requirements

- Node.js 20+
- A SportMonks API token
- Access to a Firestore project

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Set environment variables:

- `API_TOKEN`
- `SEASON_ID`

3. For local Firebase auth, either:
- run with `gcloud auth application-default login`, or
- set `GOOGLE_APPLICATION_CREDENTIALS` to a local service account key path outside the repo

## Run

```bash
API_TOKEN=your_token SEASON_ID=25539 node fantasyIngest.js
```

## Firestore collections written

- `teams/{teamId}`
- `players/{playerId}`

## Deploy to Cloud Run Jobs

Create an Artifact Registry repository once:

```bash
gcloud artifacts repositories create fantasybatch \
  --repository-format=docker \
  --location=us-central1
```

Build and push the container image:

```bash
gcloud builds submit --tag us-central1-docker.pkg.dev/PROJECT_ID/fantasybatch/fantasybatch:latest
```

Create a runtime service account for the job and grant Firestore access:

```bash
gcloud iam service-accounts create fantasybatch-job
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:fantasybatch-job@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

Store the SportMonks token in Secret Manager and allow the runtime service account to read it:

```bash
printf '%s' 'YOUR_SPORTMONKS_TOKEN' | gcloud secrets create sportmonks-api-token --data-file=-
gcloud secrets add-iam-policy-binding sportmonks-api-token \
  --member="serviceAccount:fantasybatch-job@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Create the Cloud Run job:

```bash
gcloud run jobs create fantasybatch-ingest \
  --image us-central1-docker.pkg.dev/PROJECT_ID/fantasybatch/fantasybatch:latest \
  --region us-central1 \
  --service-account fantasybatch-job@PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars SEASON_ID=25539 \
  --set-secrets API_TOKEN=sportmonks-api-token:latest
```

Run it once manually:

```bash
gcloud run jobs execute fantasybatch-ingest --region us-central1
```

Create a service account for Cloud Scheduler and allow it to invoke the job:

```bash
gcloud iam service-accounts create fantasybatch-scheduler
gcloud run jobs add-iam-policy-binding fantasybatch-ingest \
  --region us-central1 \
  --member="serviceAccount:fantasybatch-scheduler@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

Schedule it daily with Cloud Scheduler:

```bash
gcloud scheduler jobs create http fantasybatch-ingest-daily \
  --location us-central1 \
  --schedule "0 6 * * *" \
  --time-zone "America/Mexico_City" \
  --uri "https://run.googleapis.com/v2/projects/PROJECT_ID/locations/us-central1/jobs/fantasybatch-ingest:run" \
  --http-method POST \
  --oauth-service-account-email fantasybatch-scheduler@PROJECT_ID.iam.gserviceaccount.com
```

## Notes

- Cloud Run should use the attached service account through Application Default Credentials.
- Keep service account JSON keys out of the repo.
- There are no tests configured yet (`npm test` exits with an error by design).
