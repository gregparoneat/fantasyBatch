import admin from 'firebase-admin'; // Correct ES Module import for firebase-admin
import axios from 'axios';         // Correct ES Module import for axios

// --- CONFIGURATION ---
const API_TOKEN = process.env.API_TOKEN;
const SEASON_ID = Number.parseInt(process.env.SEASON_ID ?? '', 10);
const BASE_URL = 'https://api.sportmonks.com/v3/football';

function validateConfig() {
    const missingFields = [];

    if (!API_TOKEN) {
        missingFields.push('API_TOKEN');
    }

    if (!Number.isInteger(SEASON_ID)) {
        missingFields.push('SEASON_ID');
    }

    if (missingFields.length > 0) {
        throw new Error(`Missing or invalid configuration: ${missingFields.join(', ')}`);
    }
}

validateConfig();

// Uses Application Default Credentials. In Cloud Run, attach a service account
// to the job. Locally, set GOOGLE_APPLICATION_CREDENTIALS if needed.
admin.initializeApp({
    credential: admin.credential.applicationDefault()
});
const db = admin.firestore();

// --- AXIOS SETUP (With simple error handling) ---
const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
});

async function fetchTeamsAndSquads() {
    console.log(`🚀 Starting ingestion for Mexican League Season ID: ${SEASON_ID}`);

    try {
        console.log('... Fetching teams and squads from SportsMonks (Mexican League)');

        const response = await api.get(`/teams/seasons/${SEASON_ID}`, {
            params: {
                api_token: API_TOKEN,
                include: 'players'
            }
        });

        const teamsData = response.data.data;

        if (!teamsData || teamsData.length === 0) {
            console.error('❌ No teams found for this SEASON_ID. Please ensure it\'s a valid Mexican League season ID and your API token is correct.');
            return;
        }

        console.log(`✅ Found ${teamsData.length} Mexican League teams. Processing...`);

        let batch = db.batch();
        let operationCount = 0;

        for (const team of teamsData) {
            const teamRef = db.collection('teams').doc(team.id.toString());

            const teamPayload = {
                id: team.id,
                name: team.name,
                short_code: team.short_code,
                image_path: team.image_path,
                founded: team.founded,
                venue_id: team.venue_id,
                players: team.players,
                last_updated: admin.firestore.FieldValue.serverTimestamp()
            };
            let playersBatch = db.batch();
            for(const player of team.players) {
                console.log(player.player_id);
                const playerResponse = await api.get(`/players/${player.player_id}`, {
                    params: {
                        api_token: API_TOKEN,
                        include: 'nationality;statistics;position;detailedPosition;country;city'
                    }
                });
                console.log(playerResponse.data.data.display_name);
                playerResponse.data.data.team_id = team.id;
                console.log('saving player ' + playerResponse.data.data.display_name + ' from team ' + playerResponse.data.data.team_id)
                const playerRef = db.collection('players').doc(player.player_id.toString());
                playersBatch.set(playerRef, playerResponse.data, { merge: true });

            }
            console.log(`saving players batch from ${team.name}`);
            await playersBatch.commit();

            batch.set(teamRef, teamPayload, { merge: true });
            operationCount++;
        }

        if (operationCount > 0) {
            console.log(`... Committing final batch of ${operationCount} operations`);
            await batch.commit();
        }

        console.log('🎉 Mexican League Ingestion Complete!');

    } catch (error) {
        if (error.response) {
            console.error('❌ SportMonks API error:', error.response.data);
            return;
        }

        console.error('❌ Ingestion error:', error.message);

        if (error.code) {
            console.error('Error code:', error.code);
        }

        if (error.details) {
            console.error('Error details:', error.details);
        }

        if (error.stack) {
            console.error(error.stack);
        }
    }
}

fetchTeamsAndSquads();
