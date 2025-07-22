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

// Store application state
let activePoll = null;
let results = {};
let teacherSocket = null;
const connectedStudents = new Map(); // socket.id -> student name
const answeredStudents = new Set(); // socket.id of students who answered
const chatMessages = [];

// Helper functions
const calculatePercentages = () => {
  if (!activePoll) return {};
  
  const total = Object.values(results).reduce((sum, val) => sum + val, 0);
  const percentages = {};
  
  activePoll.options.forEach(option => {
    percentages[option] = Math.round(((results[option] || 0) / (total || 1)) * 100;
  });
  
  return percentages;
};

const broadcastStudentList = () => {
  io.emit('student-list-updated', Array.from(connectedStudents.values()));
};

const broadcastChatMessage = (message) => {
  io.emit('chat-message', message);
  chatMessages.push(message);
};

const checkAllStudentsAnswered = () => {
  return connectedStudents.size > 0 && 
         answeredStudents.size === connectedStudents.size;
};

const updateAnswerStatus = () => {
  if (teacherSocket) {
    io.to(teacherSocket).emit('answers-status', {
      answered: answeredStudents.size,
      total: connectedStudents.size
    });
  }
};

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Debug all events
  socket.onAny((event, ...args) => {
    console.log(`[${socket.id}] ${event}`, args.length ? args : '');
  });

  // Handle teacher authentication
  socket.on('identify-teacher', (password, callback) => {
    try {
      if (password === TEACHER_PASSWORD) {
        teacherSocket = socket.id;
        socket.isTeacher = true;
        console.log(`Teacher identified: ${socket.id}`);
        
        // Send current state to teacher
        if (activePoll) {
          socket.emit('poll-created', activePoll);
          socket.emit('results-updated', calculatePercentages());
          updateAnswerStatus();
        }
        socket.emit('chat-history', chatMessages);
        socket.emit('student-list-updated', Array.from(connectedStudents.values()));
        
        if (typeof callback === 'function') {
          callback({ status: 'success' });
        }
      } else {
        console.warn(`Failed teacher authentication attempt from ${socket.id}`);
        if (typeof callback === 'function') {
          callback({ error: 'Invalid credentials' });
        }
      }
    } catch (error) {
      console.error('Error in teacher authentication:', error);
      if (typeof callback === 'function') {
        callback({ error: 'Authentication failed' });
      }
    }
  });

  // Handle student registration
  socket.on('register-student', (data, callback) => {
    try {
      const { name } = data || {};
      
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        if (typeof callback === 'function') {
          callback({ error: 'Invalid student name (min 2 characters)' });
        }
        return;
      }
      
      const studentName = name.trim();
      
      // Check if name is already taken
      if (Array.from(connectedStudents.values()).includes(studentName)) {
        if (typeof callback === 'function') {
          callback({ error: 'Name already in use' });
        }
        return;
      }
      
      connectedStudents.set(socket.id, studentName);
      console.log(`Student registered: ${studentName} (${socket.id})`);
      
      // Notify all clients
      broadcastStudentList();
      broadcastChatMessage({
        sender: 'System',
        text: `${studentName} joined the classroom`,
        timestamp: new Date().toISOString(),
        isSystem: true
      });
      
      // Send current poll if active
      if (activePoll) {
        socket.emit('poll-created', activePoll);
        socket.emit('results-updated', calculatePercentages());
      }
      
      // Update answer status for teacher
      updateAnswerStatus();
      
      if (typeof callback === 'function') {
        callback({ status: 'success' });
      }
    } catch (error) {
      console.error('Error in student registration:', error);
      if (typeof callback === 'function') {
        callback({ error: 'Registration failed' });
      }
    }
  });

  // Teacher creates a poll
  socket.on('create-poll', (poll, callback) => {
    try {
      // Authorization check
      if (!socket.isTeacher || socket.id !== teacherSocket) {
        console.warn(`Unauthorized poll creation attempt from ${socket.id}`);
        return callback?.({ error: 'Unauthorized' });
      }

      // Check if there's an active poll and not all students have answered
      if (activePoll && answeredStudents.size < connectedStudents.size) {
        return callback?.({ 
          error: 'Cannot create new poll - not all students have answered',
          status: 'pending',
          answered: answeredStudents.size,
          total: connectedStudents.size
        });
      }

      // Clear previous poll data
      answeredStudents.clear();
      results = {};

      // Validation
      if (!poll?.question || !Array.isArray(poll.options) || poll.options.length < 2) {
        const error = 'Invalid poll data: question and at least 2 options required';
        console.warn(error);
        return callback?.({ error });
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
      
      console.log('New poll created:', activePoll);
      
      // Broadcast to all clients
      io.emit('poll-created', activePoll);
      callback?.({ status: 'success', poll: activePoll });

      // Auto-end timer
      if (activePoll.timeLimit > 0) {
        setTimeout(() => {
          if (activePoll) {
            console.log('Poll timeout reached');
            io.emit('poll-ended');
            activePoll = null;
          }
        }, activePoll.timeLimit * 1000);
      }
    } catch (error) {
      console.error('Error in poll creation:', error);
      callback?.({ error: 'Poll creation failed' });
    }
  });

  // Student submits answer
  socket.on('submit-answer', ({ answer, studentName, pollId }, callback) => {
    try {
      if (!activePoll || activePoll.question !== pollId) {
        const error = 'No active poll or poll ID mismatch';
        console.warn(`${error} from ${socket.id}`);
        return callback?.({ error });
      }

      if (!activePoll.options.includes(answer)) {
        const error = `Invalid answer "${answer}" from ${socket.id}`;
        console.warn(error);
        return callback?.({ error: 'Invalid answer' });
      }

      // Track that this student has answered
      answeredStudents.add(socket.id);

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

      // Update answer status for teacher
      updateAnswerStatus();

      // Check if all students have answered
      if (checkAllStudentsAnswered()) {
        io.emit('all-students-answered');
      }
      
      if (typeof callback === 'function') {
        callback({ 
          status: 'success',
          isCorrect: activePoll.correctAnswers.includes(answer)
        });
      }
    } catch (error) {
      console.error('Error in answer submission:', error);
      if (typeof callback === 'function') {
        callback({ error: 'Answer submission failed' });
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    try {
      console.log(`Disconnected: ${socket.id}`);
      
      const studentName = connectedStudents.get(socket.id);
      if (studentName) {
        connectedStudents.delete(socket.id);
        answeredStudents.delete(socket.id);
        console.log(`Student disconnected: ${studentName}`);
        broadcastStudentList();
        broadcastChatMessage({
          sender: 'System',
          text: `${studentName} left the classroom`,
          timestamp: new Date().toISOString(),
          isSystem: true
        });

        // Update answer status for teacher
        updateAnswerStatus();
      }
      
      if (socket.id === teacherSocket) {
        teacherSocket = null;
        console.log('Teacher disconnected');
      }
    } catch (error) {
      console.error('Error in disconnect handler:', error);
    }
  });

  // [Rest of your existing socket handlers...]
});

// [Rest of your existing server setup...]