const { Server } = require("socket.io");
const { v4: uuidv4 } = require('uuid');

const io = new Server({ /* options */ });

// Store rooms and their data
const _rooms = new Map();

console.log("starting...");

io.on('connection', (socket) => {
    console.log("Client connected!");
    const playerId = uuidv4();
    
    // Send initial connection success with player ID
    socket.emit("connectionSuccess", { playerId });

    socket.on('setPlayerName', ({ playerName }) => {
        // Store player name in socket data for later use
        socket.data.playerName = playerName;
        // Send confirmation back to client
        socket.emit("playerNameSet", { 
            playerId,
            playerName
        });
    });

    socket.on('createRoom', () => {
        const roomId = uuidv4();
        const room = {
            roomId,
            players: [{
                id: playerId,
                socketId: socket.id,
                playerName: socket.data.playerName,
                isConnected: true
            }]
        };
        
        _rooms.set(roomId, room);
        socket.join(roomId);
        socket.emit("roomCreated", { roomId });
    });

    socket.on('connectToRoom', ({ roomId }) => {
        const room = _rooms.get(roomId);
        if (!room) {
            socket.emit("error", { message: "Room not found" });
            return;
        }

        room.players.push({
            id: playerId,
            socketId: socket.id,
            playerName: socket.data.playerName,
            isConnected: true
        });

        socket.join(roomId);
        io.to(roomId).emit("roomStateChanged", {
            roomId,
            players: room.players.map(p => ({
                id: p.id,
                playerName: p.playerName,
                isConnected: p.isConnected
            }))
        });
    });

    socket.on('disconnect', () => {
        // Update player connection status in all rooms
        _rooms.forEach((room, roomId) => {
            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                player.isConnected = false;
                player.socketId = null;
                
                // Notify other players about the disconnection
                io.to(roomId).emit("roomStateChanged", {
                    roomId,
                    players: room.players.map(p => ({
                        id: p.id,
                        playerName: p.playerName,
                        isConnected: p.isConnected
                    }))
                });
            }
        });
    });
});

console.log("started");

io.listen(3000);