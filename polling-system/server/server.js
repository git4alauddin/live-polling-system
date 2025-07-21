const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // Allow React to connect
    methods: ["GET", "POST"]
  }
});

// Store active poll and answers (in-memory for now)
let activePoll = null;
let answers = {};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Send current poll to new connection
  if (activePoll) {
    socket.emit('new-poll', activePoll);
  }

  // Handle new poll from teacher
  socket.on('create-poll', (poll) => {
    activePoll = poll;
    answers = {}; // Reset answers for new poll
    io.emit('new-poll', poll); // Broadcast to all
  });

  // Handle student answer
  socket.on('submit-answer', ({ studentId, answer }) => {
    answers[studentId] = answer;
    io.emit('update-results', answers); // Broadcast results
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});