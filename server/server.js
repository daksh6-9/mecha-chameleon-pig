const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {};

io.on('connection', (socket) => {
    console.log(`[NET] Connected: ${socket.id}`);

    // --- 1. JOIN ROOM ---
    socket.on('joinRoom', ({ username, roomCode }) => {
        const code = (roomCode || 'LOBBY').trim().toUpperCase();
        socket.currentRoom = code;
        socket.username = username || 'CyberPig';

        if (!rooms[code]) {
            rooms[code] = {
                players: {},
                lobbyTimer: 200,
                matchTimer: 120,
                gameState: 'WAITING_ROOM', // WAITING_ROOM | HIDING_PHASE | HUNTING_PHASE
                timerInterval: null
            };

            // Start 200-second Lobby Countdown Loop
            rooms[code].timerInterval = setInterval(() => {
                const r = rooms[code];
                if (!r) return;

                if (r.gameState === 'WAITING_ROOM') {
                    if (r.lobbyTimer > 0) r.lobbyTimer--;
                    if (r.lobbyTimer <= 0) {
                        startMatch(code);
                    }
                } else if (r.gameState === 'HIDING_PHASE') {
                    if (r.matchTimer > 0) r.matchTimer--;
                    if (r.matchTimer <= 0) {
                        r.gameState = 'HUNTING_PHASE';
                        io.to(code).emit('huntingPhaseStarted');
                    }
                }

                // Broadcast live clock tick
                io.to(code).emit('timerUpdate', {
                    lobbyTimer: r.lobbyTimer,
                    matchTimer: r.matchTimer,
                    gameState: r.gameState
                });
            }, 1000);
        }

        socket.join(code);

        rooms[code].players[socket.id] = {
            id: socket.id,
            username: socket.username,
            position: { x: 0, y: 1.0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            isReady: false,
            isOnStep: false,
            isHunter: false
        };

        // Confirm room join
        socket.emit('roomJoined', code);
        socket.emit('currentPlayers', rooms[code].players);
        socket.to(code).emit('newPlayer', rooms[code].players[socket.id]);

        // Send immediate Timer & Ready status updates to the newly joined player
        const allPlayers = Object.values(rooms[code].players);
        const readyCount = allPlayers.filter(p => p.isReady).length;
        
        io.to(code).emit('readyStatusUpdate', {
            readyCount: readyCount,
            totalPlayers: allPlayers.length
        });

        socket.emit('timerUpdate', {
            lobbyTimer: rooms[code].lobbyTimer,
            matchTimer: rooms[code].matchTimer,
            gameState: rooms[code].gameState
        });
    });

    // --- 2. READY TOGGLE HANDLER ---
    socket.on('toggleReady', () => {
        const code = socket.currentRoom;
        if (code && rooms[code] && rooms[code].players[socket.id]) {
            const p = rooms[code].players[socket.id];
            p.isReady = !p.isReady;

            const allPlayers = Object.values(rooms[code].players);
            const readyCount = allPlayers.filter(player => player.isReady).length;

            // Broadcast updated ready fraction (e.g. 1/2, 2/2)
            io.to(code).emit('readyStatusUpdate', {
                readyCount: readyCount,
                totalPlayers: allPlayers.length
            });

            // If ALL players are ready, jump timer down to 10s!
            if (readyCount === allPlayers.length && readyCount > 0) {
                rooms[code].lobbyTimer = Math.min(rooms[code].lobbyTimer, 10);
                io.to(code).emit('timerUpdate', {
                    lobbyTimer: rooms[code].lobbyTimer,
                    matchTimer: rooms[code].matchTimer,
                    gameState: rooms[code].gameState
                });
            }
        }
    });

    // --- 3. POSITION & STEP UPDATES ---
    socket.on('checkHunterStep', ({ isOnStep }) => {
        const code = socket.currentRoom;
        if (code && rooms[code] && rooms[code].players[socket.id]) {
            rooms[code].players[socket.id].isOnStep = isOnStep;
        }
    });

    socket.on('updateState', (state) => {
        const code = socket.currentRoom;
        if (code && rooms[code] && rooms[code].players[socket.id]) {
            const p = rooms[code].players[socket.id];
            p.position = state.position || p.position;
            p.rotation = state.rotation || p.rotation;

            socket.to(code).emit('playerMoved', {
                id: socket.id,
                position: p.position,
                rotation: p.rotation,
                posture: state.posture
            });
        }
    });

    // --- 4. START MATCH LIFECYCLE ---
    function startMatch(code) {
        const room = rooms[code];
        if (!room) return;

        room.gameState = 'HIDING_PHASE';
        const playersArr = Object.values(room.players);
        const stepCandidates = playersArr.filter(p => p.isOnStep);

        let hunterId = null;
        if (stepCandidates.length === 1) {
            hunterId = stepCandidates[0].id;
        } else if (playersArr.length > 0) {
            const randomIdx = Math.floor(Math.random() * playersArr.length);
            hunterId = playersArr[randomIdx].id;
        }

        playersArr.forEach(p => {
            p.isHunter = (p.id === hunterId);
        });

        io.to(code).emit('matchStarted', {
            hunterId: hunterId,
            spawnOffset: { x: 50, y: 1.0, z: 0 }
        });
    }

    // --- 5. DISCONNECT CLEANUP ---
    socket.on('disconnect', () => {
        const code = socket.currentRoom;
        if (code && rooms[code]) {
            delete rooms[code].players[socket.id];
            socket.to(code).emit('playerDisconnected', socket.id);

            const remaining = Object.values(rooms[code].players);
            if (remaining.length === 0) {
                clearInterval(rooms[code].timerInterval);
                delete rooms[code];
            } else {
                io.to(code).emit('readyStatusUpdate', {
                    readyCount: remaining.filter(p => p.isReady).length,
                    totalPlayers: remaining.length
                });
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));