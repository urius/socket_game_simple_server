const { Server } = require("socket.io");
const { v4: uuidv4 } = require('uuid');

const io = new Server({ /* options */ });

// Store rooms and their data
const _rooms = new Map();
// Store roomId by socketId
const _socketToRoom = new Map();

console.log("starting...");

io.on('connection', (socket) => {
    console.log("Client connected!");
    const playerId = uuidv4();
    
    // Send initial connection success with player ID
    socket.emit("connectionSuccess", playerId);

    socket.on('setPlayerName', (playerName) => {
        // Store player name in socket data for later use
        socket.data.playerName = playerName;
        // Send confirmation back to client
        socket.emit("playerNameSet", JSON.stringify({ 
            playerId,
            playerName
        }));
    });

    socket.on('createRoom', () => {
        const roomId = uuidv4();
        const room = {
            roomId,
            players: [{
                id: playerId,
                socketId: socket.id,
                playerName: socket.data.playerName,
                isConnected: true,
                isReady: false,
                connectionIndex: 0
            }]
        };
        
        _rooms.set(roomId, room);
        _socketToRoom.set(socket.id, roomId);
        socket.join(roomId);
        socket.emit("roomCreated", roomId);
    });

    socket.on('connectToRoom', (roomId) => {
        const room = _rooms.get(roomId);
        if (!room) {
            socket.emit("error", "Room not found");
            return;
        }

        // Calculate next connection index
        const nextConnectionIndex = room.players.length;

        room.players.push({
            id: playerId,
            socketId: socket.id,
            playerName: socket.data.playerName,
            isConnected: true,
            isReady: false,
            connectionIndex: nextConnectionIndex
        });

        _socketToRoom.set(socket.id, roomId);
        socket.join(roomId);
        io.to(roomId).emit("roomStateChanged", JSON.stringify({
            roomId,
            players: room.players.map(p => ({
                id: p.id,
                playerName: p.playerName,
                isConnected: p.isConnected,
                isReady: p.isReady,
                connectionIndex: p.connectionIndex
            }))
        }));
    });

    socket.on('send', (message) => {
        const roomId = _socketToRoom.get(socket.id);
        if (!roomId) {
            socket.emit("error", "Player not in any room");
            return;
        }

        const room = _rooms.get(roomId);
        if (!room) {
            socket.emit("error", "Room not found");
            return;
        }

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) {
            socket.emit("error", "Player not found in room");
            return;
        }

        // Send message to all players in the room except sender
        socket.to(roomId).emit("message", JSON.stringify({
            roomId,
            playerId,
            playerName: player.playerName,
            message
        }));
    });

    socket.on('setReady', (data) => {
        const { roomId, playerId, isReady } = JSON.parse(data);
        
        const room = _rooms.get(roomId);
        if (!room) {
            socket.emit("error", "Room not found");
            return;
        }

        const player = room.players.find(p => p.id === playerId);
        if (!player) {
            socket.emit("error", "Player not found in room");
            return;
        }

        player.isReady = isReady;
        
        // Notify all players in the room about the state change
        io.to(roomId).emit("roomStateChanged", JSON.stringify({
            roomId,
            players: room.players.map(p => ({
                id: p.id,
                playerName: p.playerName,
                isConnected: p.isConnected,
                isReady: p.isReady,
                connectionIndex: p.connectionIndex
            }))
        }));
    });

    socket.on('disconnect', () => {
        const roomId = _socketToRoom.get(socket.id);
        if (roomId) {
            _socketToRoom.delete(socket.id);
            
            const room = _rooms.get(roomId);
            if (room) {
                const player = room.players.find(p => p.socketId === socket.id);
                if (player) {
                    player.isConnected = false;
                    player.socketId = null;
                    
                    // Check if this was the last connected player
                    const connectedPlayers = room.players.filter(p => p.isConnected);
                    if (connectedPlayers.length === 0) {
                        // Remove the room if no players are connected
                        _rooms.delete(roomId);
                        console.log(`Room ${roomId} removed - no connected players`);
                    } else {
                        // Notify remaining players about the disconnection
                        io.to(roomId).emit("roomStateChanged", JSON.stringify({
                            roomId,
                            players: room.players.map(p => ({
                                id: p.id,
                                playerName: p.playerName,
                                isConnected: p.isConnected,
                                isReady: p.isReady,
                                connectionIndex: p.connectionIndex
                            }))
                        }));
                    }
                }
            }
        }
    });
});

console.log("started");

io.listen(3000);