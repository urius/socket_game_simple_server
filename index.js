const { Server } = require("socket.io");

const io = new Server({ /* options */ });

console.log("starting...");

io.on('connection', (socket) => {
    console.log("Got connection!");

    socket.on('testEvent', (data) => {
        console.log("Received test Event " + data);
    });

    soc = socket;
    socket.emit("testEvent", "Sending");
});

console.log("started");

io.listen(3000);