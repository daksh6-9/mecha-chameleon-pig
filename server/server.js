const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Rooms Store: { 'ROOMCODE': { players: { 'socket_id': { id, username, position, rotation, posture, color, isHunter } } } }
const rooms = {};

io.on('connection', (socket) => {
    console.log(`[NET] Client connected: ${socket.id}`);

    // --- 1. JOIN / CREATE ROOM ---
    socket.on('joinRoom', ({ username, roomCode, isHost }) => {
        const code = (roomCode || 'LOBBY').trim().toUpperCase();
        socket.currentRoom = code;
        socket.username = username || 'CyberPig';

        if (!rooms[code]) {
            rooms[code] = {
                players: {},
                hunterCandidate: 'NONE'
            };
            console.log(`[ROOM] Created private room: ${code}`);
        }

        socket.join(code);

        // Define initial player profile
        const newPlayerData = {
            id: socket.id,
            username: socket.username,
            position: { x: (Math.random() - 0.5) * 10, y: 1.0, z: (Math.random() - 0.5) * 10 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            color: '#ff0055',
            posture: 'reset',
            isOnStep: false,
            isHunter: false
        };

        // Save into room store
        rooms[code].players[socket.id] = newPlayerData;

        // A. Confirm room join to sender
        socket.emit('roomJoined', code);

        // B. Send ALL existing players in room to the newly joined player
        socket.emit('currentPlayers', rooms[code].players);

        // C. Notify ALL OTHER players in this room about the new player
        socket.to(code).emit('newPlayer', newPlayerData);

        console.log(`[ROOM] ${socket.username} (${socket.id}) entered [${code}]. Total room players: ${Object.keys(rooms[code].players).length}`);
    });

    // --- 2. LIVE REAL-TIME MOVEMENT & STATE TICK ---
    socket.on('updateState', (state) => {
        const code = socket.currentRoom;
        if (code && rooms[code] && rooms[code].players[socket.id]) {
            const p = rooms[code].players[socket.id];
            
            // Update local memory
            p.position = state.position || p.position;
            p.rotation = state.rotation || p.rotation;
            if (state.posture) p.posture = state.posture;
            if (state.color) p.color = state.color;

            // Broadcast movement payload ONLY to peers inside the same room
            socket.to(code).emit('playerMoved', {
                id: socket.id,
                position: p.position,
                rotation: p.rotation,
                posture: p.posture,
                color: p.color
            });
        }
    });

    // --- 3. HUNTER STEP CANDIDATE LOGIC ---
    socket.on('checkHunterStep', ({ roomCode, isOnStep }) => {
        const code = socket.currentRoom || (roomCode ? roomCode.toUpperCase() : null);
        if (code && rooms[code] && rooms[code].players[socket.id]) {
            rooms[code].players[socket.id].isOnStep = isOnStep;

            const candidates = Object.values(rooms[code].players).filter(p => p.isOnStep);
            let candidateName = "NONE";
            if (candidates.length === 1) {
                candidateName = candidates[0].username;
            } else if (candidates.length > 1) {
                candidateName = "CONTESTED (RANDOM DRAW)";
            }

            rooms[code].hunterCandidate = candidateName;
            io.to(code).emit('hunterCandidateUpdate', { candidateName });
        }
    });

    // --- 4. DISCONNECT CLEANUP ---
    socket.on('disconnect', () => {
        const code = socket.currentRoom;
        console.log(`[NET] Client disconnected: ${socket.id}`);

        if (code && rooms[code]) {
            delete rooms[code].players[socket.id];
            
            // Tell other clients in room to remove the player mesh
            socket.to(code).emit('playerDisconnected', socket.id);

            // Clean up empty rooms
            if (Object.keys(rooms[code].players).length === 0) {
                delete rooms[code];
                console.log(`[ROOM] Closed empty room: ${code}`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 MECHA CHAMELEON PIG SERVER ONLINE ON PORT ${PORT}`);
    console.log(`==================================================\n`);
});