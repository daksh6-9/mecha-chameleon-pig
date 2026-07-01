const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Store all connected players
const players = {};

io.on('connection', (socket) => {
    console.log(`User connected to the grid: ${socket.id}`);
    
    // Assign role (Toggle between Hunter and Runner)
    const role = Object.keys(players).length % 2 === 0 ? 'Hunter' : 'Runner';
    
    // Create their default server profile
    players[socket.id] = {
        id: socket.id,
        role: role,
        position: { x: 0, y: 5, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        isCamouflaged: false
    };

    // 1. Tell the new player who they are
    socket.emit('init', { role: role });
    
    // 2. Give the new player the positions of everyone already playing
    socket.emit('currentPlayers', players);
    
    // 3. Tell everyone else that a new player just dropped in
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 4. Listen for movements and instantly broadcast them
    socket.on('updateState', (state) => {
        if (players[socket.id]) {
            players[socket.id].position = state.position;
            players[socket.id].rotation = state.rotation;
            players[socket.id].isCamouflaged = state.isCamouflaged;
            
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 5. Handle disconnects gracefully
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Mainframe Server running on port 3000');
});