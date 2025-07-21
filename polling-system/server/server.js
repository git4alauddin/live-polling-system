const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 30000,
    skipMiddlewares: true
  }
});

// Store active poll and results
let activePoll = null;
let results = {};
let teacherSocket = null;

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Debug all events
  socket.onAny((event, ...args) => {
    console.log(`[${socket.id}] ${event}`, args.length ? args : '');
  });

  // Handle role identification
  socket.on('identify-teacher', () => {
    teacherSocket = socket.id;
    console.log(`Teacher identified: ${socket.id}`);
    if (activePoll) {
      socket.emit('current-poll', activePoll);
    }
  });

  // Handle poll requests from students
  socket.on('request-poll', (callback) => {
    console.log(`Poll request from ${socket.id}`);
    callback(activePoll || null);
  });

  // Send current poll to new connections
  if (activePoll) {
    console.log(`Sending active poll to ${socket.id}`);
    socket.emit('poll-created', activePoll);
  }

  // Teacher creates a poll
  socket.on('create-poll', (poll, callback) => {
    if (socket.id !== teacherSocket) {
      console.warn(`Unauthorized poll creation attempt from ${socket.id}`);
      return callback({ error: 'Unauthorized' });
    }

    activePoll = {
      question: poll.question,
      options: poll.options.filter(opt => typeof opt === 'string'),
      timeLimit: Math.min(Number(poll.timeLimit || 60), 300),
      createdAt: Date.now()
    };
    results = {};
    
    console.log('New poll created:', activePoll);
    
    // Broadcast with acknowledgement
    io.sockets.emit('poll-created', activePoll);
    callback({ status: 'success' });

    // Auto-close poll after timeout
    if (activePoll.timeLimit > 0) {
      setTimeout(() => {
        console.log('Poll timeout reached');
        io.emit('poll-ended');
      }, activePoll.timeLimit * 1000);
    }
  });

  // Student submits answer
  socket.on('submit-answer', ({ answer }, callback) => {
    if (!activePoll) {
      console.warn(`Answer received but no active poll from ${socket.id}`);
      return callback({ error: 'No active poll' });
    }

    if (!activePoll.options.includes(answer)) {
      console.warn(`Invalid answer "${answer}" from ${socket.id}`);
      return callback({ error: 'Invalid answer' });
    }

    results[answer] = (results[answer] || 0) + 1;
    const total = Object.values(results).reduce((sum, val) => sum + val, 0);
    
    const percentages = {};
    activePoll.options.forEach(option => {
      percentages[option] = Math.round(((results[option] || 0) / total) * 100);
    });

    console.log('Updated results:', percentages);
    io.emit('results-updated', percentages);
    callback({ status: 'success' });
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    if (socket.id === teacherSocket) {
      teacherSocket = null;
      console.log('Teacher disconnected');
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activePoll: !!activePoll,
    connections: io.engine.clientsCount
  });
});

server.listen(4000, () => {
  console.log('Server running on port 4000');
  console.log('WebSocket path:', io.path());
});