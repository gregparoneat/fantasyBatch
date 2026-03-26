// Change: import 'dotenv/config'; to configure dotenv for ES Modules
import 'dotenv/config';

// Change: import serviceAccount from './serviceAccountKey.json';
import serviceAccount from './serviceAccountKey.json' with { type: 'json' };

import admin from 'firebase-admin'; // Correct ES Module import for firebase-admin
import axios from 'axios';         // Correct ES Module import for axios

// --- CONFIGURATION ---
const API_TOKEN = 'gsZEnYqYpLsfVPRhca4EJSSxVnfwJjTxBvX7ZwSx1cv90QHGcA6YnJzaZqf9';
const SEASON_ID = 25539; // <--- UPDATE THIS WITH YOUR MEXICAN LEAGUE SEASON ID
const BASE_URL = 'https://api.sportmonks.com/v3/football';

// --- FIREBASE INIT ---
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- AXIOS SETUP (With simple error handling) ---
const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

        const batchSize = 400;
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
        console.error('❌ Error during ingestion:', error.response ? error.response.data : error.message);
    }
}

fetchTeamsAndSquads();
