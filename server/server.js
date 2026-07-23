const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// --- ROOMS DATA STRUCTURE ---
// Keeps track of active private parties: { 'A4X9': { players: {...} }, ... }
const rooms = {};

io.on('connection', (socket) => {
    console.log(`Device connected to handshake gateway: ${socket.id}`);

    // --- HANDLE JOINING/CREATING A PRIVATE PARTY ---
    socket.on('joinRoom', ({ username, roomCode, isHost }) => {
        // Force uppercase for consistent matching
        const code = roomCode.trim().toUpperCase();
        
        // Save room details directly onto the socket instance for easy lookup later
        socket.currentRoom = code;
        socket.username = username;

        // Create the room on the server if it doesn't exist yet
        if (!rooms[code]) {
            rooms[code] = {
                players: {}
            };
            console.log(`🆕 Private party chamber created: ${code}`);
        }

        // Connect this player's network pipe into the isolated Socket.IO room channel
        socket.join(code);

        // Assign roles dynamically based on how many players are ALREADY in this specific room
        const currentRoomPlayers = Object.keys(rooms[code].players);
        const role = currentRoomPlayers.length % 2 === 0 ? 'Hunter' : 'Runner';

        // Build their localized server profile
        rooms[code].players[socket.id] = {
            id: socket.id,
            username: username,
            role: role,
            position: { x: 0, y: 5, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            isCamouflaged: false
        };

        console.log(`👤 ${username} locked into Room [${code}] with role: ${role}`);

        // 1. Confirm successful connection back to the client
        socket.emit('roomJoined', code);

        // 2. Tell the specific player who they are inside this room
        socket.emit('init', { role: role });

        // 3. Send them the positions of only the players already inside their private party
        socket.emit('currentPlayers', rooms[code].players);

        // 4. Alert everyone else in that specific room that a new pig has joined the grid
        socket.to(code).emit('newPlayer', rooms[code].players[socket.id]);
    });

    // --- ROOM-BOUND TRANSMISSION RECEIVER ---
    socket.on('updateState', (state) => {
        const code = socket.currentRoom;
        
        // Ensure the room and player profile exist before writing data
        if (code && rooms[code] && rooms[code].players[socket.id]) {
            const player = rooms[code].players[socket.id];
            player.position = state.position;
            player.rotation = state.rotation;
            player.isCamouflaged = state.isCamouflaged;

            // Broadcast the state changes ONLY to matching room members
            socket.to(code).emit('playerMoved', player);
        }
    });

    // --- DISCONNECT HANDLING ---
    socket.on('disconnect', () => {
        const code = socket.currentRoom;
        console.log(`User dropped link: ${socket.id} (${socket.username || 'Unregistered'})`);

        if (code && rooms[code]) {
            // Clean out the player from the room list
            delete rooms[code].players[socket.id];

            // Inform remaining party members to clear that mesh component immediately
            socket.to(code).emit('playerDisconnected', socket.id);

            // Clean up empty rooms to save system memory
            if (Object.keys(rooms[code].players).length === 0) {
                delete rooms[code];
                console.log(`♻️ Empty party chamber [${code}] safely garbage collected.`);
            }
        }
    });
});

server.listen(3000, () => {
    console.log('Mainframe Server running on port 3000');
});