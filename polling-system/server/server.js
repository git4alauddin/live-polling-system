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

// Configuration
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || 'teacher123';
const MAX_POLL_DURATION = 300; // 5 minutes maximum

// Store active poll and results
let activePoll = null;
let results = {};
let teacherSocket = null;

// Helper function to calculate percentages
const calculatePercentages = () => {
  if (!activePoll) return {};
  
  const total = Object.values(results).reduce((sum, val) => sum + val, 0);
  const percentages = {};
  
  activePoll.options.forEach(option => {
    percentages[option] = Math.round(((results[option] || 0) / (total || 1)) * 100);
  });
  
  return percentages;
};

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Debug all events
  socket.onAny((event, ...args) => {
    console.log(`[${socket.id}] ${event}`, args.length ? args : '');
  });

  // Handle teacher authentication
  socket.on('identify-teacher', (password, callback) => {
    if (password === TEACHER_PASSWORD) {
      teacherSocket = socket.id;
      console.log(`Teacher identified: ${socket.id}`);
      
      // Send current state to reconnecting teacher
      if (activePoll) {
        socket.emit('poll-created', activePoll);
        socket.emit('results-updated', calculatePercentages());
      }
      
      callback({ status: 'success' });
    } else {
      console.warn(`Failed teacher authentication attempt from ${socket.id}`);
      callback({ error: 'Invalid credentials' });
    }
  });

  // Handle poll requests from students
  socket.on('request-poll', (callback) => {
    if (typeof callback === 'function') {
      callback(activePoll || null);
    }
  });

  // Send current poll to new connections
  if (activePoll) {
    socket.emit('poll-created', activePoll);
    socket.emit('results-updated', calculatePercentages());
  }

  // Teacher creates a poll
  socket.on('create-poll', (poll, callback) => {
    // Authorization check
    if (socket.id !== teacherSocket) {
      console.warn(`Unauthorized poll creation attempt from ${socket.id}`);
      if (typeof callback === 'function') {
        return callback({ error: 'Unauthorized' });
      }
      return socket.emit('error', { message: 'Unauthorized poll creation attempt' });
    }

    // Validation
    if (!poll || !poll.question || !Array.isArray(poll.options) || poll.options.length < 2) {
      const error = 'Invalid poll data: question and at least 2 options required';
      console.warn(error);
      if (typeof callback === 'function') {
        return callback({ error });
      }
      return socket.emit('error', { message: error });
    }

    // Create new poll
    activePoll = {
      question: poll.question.trim(),
      options: poll.options
        .filter(opt => typeof opt === 'string')
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0),
      correctAnswers: Array.isArray(poll.correctAnswers) 
        ? poll.correctAnswers
          .filter(opt => typeof opt === 'string')
          .map(opt => opt.trim())
          .filter(opt => opt.length > 0)
        : [],
      timeLimit: Math.min(Number(poll.timeLimit || 60), MAX_POLL_DURATION),
      createdAt: Date.now()
    };
    
    results = {};
    console.log('New poll created:', activePoll);
    
    // Broadcast to all clients
    io.emit('poll-created', activePoll);
    
    // Send acknowledgement
    if (typeof callback === 'function') {
      callback({ status: 'success', poll: activePoll });
    }

    // Auto-end poll after timeout
    if (activePoll.timeLimit > 0) {
      setTimeout(() => {
        if (activePoll) { // Check if poll still exists
          console.log('Poll timeout reached');
          io.emit('poll-ended');
          activePoll = null;
        }
      }, activePoll.timeLimit * 1000);
    }
  });

  // Student submits answer
  socket.on('submit-answer', ({ answer, studentName, pollId }, callback) => {
    if (!activePoll || activePoll.question !== pollId) {
      const error = 'No active poll or poll ID mismatch';
      console.warn(`${error} from ${socket.id}`);
      if (typeof callback === 'function') {
        return callback({ error });
      }
      return socket.emit('error', { message: error });
    }

    if (!activePoll.options.includes(answer)) {
      const error = `Invalid answer "${answer}" from ${socket.id}`;
      console.warn(error);
      if (typeof callback === 'function') {
        return callback({ error });
      }
      return socket.emit('error', { message: 'Invalid answer' });
    }

    // Update results
    results[answer] = (results[answer] || 0) + 1;
    const percentages = calculatePercentages();
    
    console.log(`Answer received from ${studentName}:`, {
      answer,
      isCorrect: activePoll.correctAnswers.includes(answer),
      percentages
    });
    
    // Broadcast updated results
    io.emit('results-updated', percentages);
    
    // Send acknowledgement
    if (typeof callback === 'function') {
      callback({ 
        status: 'success',
        isCorrect: activePoll.correctAnswers.includes(answer)
      });
    }
  });

  // Teacher ends poll manually
  socket.on('end-poll', (callback) => {
    if (socket.id !== teacherSocket) {
      const error = 'Unauthorized poll end attempt';
      console.warn(`${error} from ${socket.id}`);
      if (typeof callback === 'function') {
        return callback({ error });
      }
      return socket.emit('error', { message: error });
    }

    if (activePoll) {
      console.log('Teacher ended poll manually');
      io.emit('poll-ended');
      activePoll = null;
      
      if (typeof callback === 'function') {
        callback({ status: 'success' });
      }
    }
  });

  // Handle disconnection
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
    timestamp: new Date().toISOString(),
    activePoll: !!activePoll,
    connections: io.engine.clientsCount,
    teacherConnected: !!teacherSocket
  });
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('WebSocket path:', io.path());
});

// Cleanup on server shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server terminated');
    process.exit(0);
  });
});