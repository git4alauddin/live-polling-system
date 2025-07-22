import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  autoConnect: false
});

function TeacherView() {
  // Poll creation state
  const [question, setQuestion] = useState('');
  const [timeLimit, setTimeLimit] = useState(60);
  const [options, setOptions] = useState([
    { id: 1, text: 'Yes', checked: false },
    { id: 2, text: 'No', checked: false }
  ]);

  // Poll management state
  const [activePoll, setActivePoll] = useState(null);
  const [results, setResults] = useState({});
  const [students, setStudents] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [canCreateNewPoll, setCanCreateNewPoll] = useState(true);
  const [answerStatus, setAnswerStatus] = useState({
    answered: 0,
    total: 0
  });

  // Chat and participants state
  const [activeTab, setActiveTab] = useState('participants');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Teacher authentication
  useEffect(() => {
    const connectToSocket = () => {
      socket.connect();
      console.log('Connecting to server...');
    };

    const handleConnect = () => {
      console.log('✅ Connected to server with ID:', socket.id);
      setConnectionStatus('connected');
      socket.emit('identify-teacher', 'teacher123', (response) => {
        if (response.error) {
          alert('Teacher authentication failed: ' + response.error);
        } else {
          setIsAuthenticated(true);
          console.log('Teacher authenticated successfully');
        }
      });
    };

    const handleDisconnect = () => {
      console.log('⚠️ Disconnected from server');
      setConnectionStatus('disconnected');
    };

    connectToSocket();

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('poll-created', handlePollCreated);
    socket.on('results-updated', handleResultsUpdated);
    socket.on('student-list-updated', handleStudentListUpdated);
    socket.on('chat-message', handleChatMessage);
    socket.on('chat-history', handleChatHistory);
    socket.on('all-students-answered', handleAllStudentsAnswered);
    socket.on('poll-ended', handlePollEnded);
    socket.on('answers-status', handleAnswersStatus);
    socket.on('teacher-state-update', handleTeacherStateUpdate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('poll-created', handlePollCreated);
      socket.off('results-updated', handleResultsUpdated);
      socket.off('student-list-updated', handleStudentListUpdated);
      socket.off('chat-message', handleChatMessage);
      socket.off('chat-history', handleChatHistory);
      socket.off('all-students-answered', handleAllStudentsAnswered);
      socket.off('poll-ended', handlePollEnded);
      socket.off('answers-status', handleAnswersStatus);
      socket.off('teacher-state-update', handleTeacherStateUpdate);
    };
  }, []);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Event handlers
  const handlePollCreated = (newPoll) => {
    setActivePoll(newPoll);
    setResults({});
    setCanCreateNewPoll(false);
    setAnswerStatus(prev => ({ ...prev, answered: 0 }));
  };

  const handleResultsUpdated = (newResults) => {
    setResults(newResults);
  };

  const handleStudentListUpdated = (studentList) => {
    setStudents(studentList);
    setAnswerStatus(prev => ({ ...prev, total: studentList.length }));
  };

  const handleChatMessage = (message) => {
    setMessages(prev => [...prev, message]);
  };

  const handleChatHistory = (history) => {
    setMessages(history || []);
  };

  const handleAllStudentsAnswered = () => {
    setCanCreateNewPoll(true);
  };

  const handlePollEnded = () => {
    setActivePoll(null);
    setCanCreateNewPoll(true);
    setAnswerStatus(prev => ({ answered: 0, total: prev.total }));
  };

  const handleAnswersStatus = (status) => {
    setAnswerStatus(status);
    setCanCreateNewPoll(status.answered === status.total);
  };

  const handleTeacherStateUpdate = (state) => {
    if (state.activePoll) {
      setActivePoll(state.activePoll);
      setResults(state.results);
      setAnswerStatus({
        answered: state.participation.answered,
        total: state.participation.total
      });
      setCanCreateNewPoll(state.participation.answered === state.participation.total);
    }
    setMessages(state.chatHistory || []);
    setStudents(state.students || []);
  };

  const createPoll = () => {
    if (!isAuthenticated) {
      alert('Please authenticate as teacher first');
      return;
    }

    if (!canCreateNewPoll) {
      alert(`Cannot create new poll - ${answerStatus.answered}/${answerStatus.total} students have answered`);
      return;
    }

    const allOptions = options
      .filter(opt => opt.text.trim())
      .map(opt => opt.text);
    const correctAnswers = options
      .filter(opt => opt.checked && opt.text.trim())
      .map(opt => opt.text);

    if (!question.trim() || allOptions.length < 2) {
      alert('Please enter a question and at least 2 options');
      return;
    }

    const newPoll = {
      question: question.trim(),
      options: allOptions,
      correctAnswers,
      timeLimit: Math.min(Number(timeLimit), 300)
    };

    socket.emit('create-poll', newPoll, (response) => {
      if (response?.error) {
        alert('Failed to create poll: ' + response.error);
      } else {
        setQuestion('');
        setTimeLimit(60);
        setOptions([
          { id: 1, text: 'Yes', checked: false },
          { id: 2, text: 'No', checked: false }
        ]);
      }
    });
  };

  const endPoll = () => {
    socket.emit('end-poll', (response) => {
      if (response?.error) {
        alert('Failed to end poll: ' + response.error);
      }
    });
  };

  const addOption = () => {
    const newId = options.length > 0 ? Math.max(...options.map(o => o.id)) + 1 : 1;
    setOptions([...options, { id: newId, text: '', checked: false }]);
  };

  const updateOption = (id, text) => {
    setOptions(options.map(opt =>
      opt.id === id ? { ...opt, text } : opt
    ));
  };

  const toggleOption = (id) => {
    setOptions(options.map(opt =>
      opt.id === id ? { ...opt, checked: !opt.checked } : opt
    ));
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      socket.emit('teacher-message', {
        text: newMessage.trim()
      });
      setNewMessage('');
    }
  };

  const kickStudent = (studentName) => {
    if (window.confirm(`Are you sure you want to remove ${studentName} from the classroom?`)) {
      socket.emit('kick-student', studentName);
    }
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-prompt">
        <div className="connection-status">
          {connectionStatus === 'connected' ? (
            <>
              <div className="status-indicator connected" />
              <p>Connected to server</p>
            </>
          ) : (
            <>
              <div className="status-indicator connecting" />
              <p>Connecting to server...</p>
            </>
          )}
        </div>
        <h2>Teacher Authentication</h2>
        <p>Please wait while we verify your credentials...</p>
      </div>
    );
  }

  return (
    <div className="teacher-view">
      {/* Menu Toggle Button */}
      <button
        className="menu-toggle"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        {isMenuOpen ? '×' : '☰'}
      </button>

      {/* Side Menu */}
      <div className={`side-menu ${isMenuOpen ? 'open' : ''}`}>
        <div className="menu-tabs">
          <button
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={activeTab === 'participants' ? 'active' : ''}
            onClick={() => setActiveTab('participants')}
          >
            Participants ({students.length})
          </button>
        </div>

        {activeTab === 'chat' && (
          <div className="chat-container">
            <div className="messages">
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`message ${msg.sender === 'Teacher' ? 'teacher' : msg.isSystem ? 'system' : 'student'}`}
                >
                  <div className="message-header">
                    <strong>{msg.sender}</strong>
                    <span className="timestamp">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                  <div className="message-text">
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="message-input">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button 
                onClick={sendMessage}
                disabled={!newMessage.trim()}
              >
                Send
              </button>
            </div>
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="participants-list">
            {/* <h3>Connected Students ({students.length})</h3> */}
            {students.length === 0 ? (
              <p className="no-students">No students connected</p>
            ) : (
              <ul>
                {students.map((student, i) => (
                  <li key={i}>
                    <span>👤 {student}</span>
                    <button
                      className="kick-btn"
                      onClick={() => kickStudent(student)}
                      title="Remove student"
                    >
                      block
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>


      {/* Main Content */}
      <div className={`main-content ${isMenuOpen ? 'menu-open' : ''}`}>
        {!activePoll ? (
          <div className="poll-creator">
            <h1>Create a New Poll</h1>
            <p>Enter your question and options below</p>

            <div className="form-group">
              <label>Question</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter your question"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Time limit (seconds, max 300)</label>
              <input
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(Math.max(10, Math.min(300, e.target.value)))}
                min="10"
                max="300"
              />
            </div>

            <div className="options-editor">
              <label>Poll Options (check correct answers)</label>
              {options.map(option => (
                <div key={option.id} className="option-item">
                  <input
                    type="checkbox"
                    checked={option.checked}
                    onChange={() => toggleOption(option.id)}
                    disabled={!option.text.trim()}
                  />
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updateOption(option.id, e.target.value)}
                    placeholder="Option text"
                  />
                  {options.length > 2 && (
                    <button
                      className="remove-option"
                      onClick={() => setOptions(options.filter(opt => opt.id !== option.id))}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button className="add-option" onClick={addOption}>
                + Add Option
              </button>
            </div>

            <button
              className="submit-btn"
              onClick={createPoll}
              disabled={!question.trim() || options.filter(opt => opt.text.trim()).length < 2}
            >
              Create Poll
            </button>
          </div>
        ) : (
          <div className="poll-results">
            <div className="poll-header">
              <h1>Live Poll Results</h1>
              <h2>{activePoll.question}</h2>
              <div className="poll-status">
                <div className="participation">
                  {answerStatus.answered} of {answerStatus.total} students answered
                  ({answerStatus.total > 0 ? Math.round((answerStatus.answered / answerStatus.total) * 100) : 0}%)
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ 
                      width: `${answerStatus.total > 0 ? (answerStatus.answered / answerStatus.total) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="results-list">
              {activePoll.options.map((option, index) => (
                <div key={index} className="result-item">
                  <div className="option-info">
                    <span className="option-text">{option}</span>
                    {activePoll.correctAnswers.includes(option) && (
                      <span className="correct-mark">✓ Correct Answer</span>
                    )}
                  </div>
                  <div className="percentage-bar-container">
                    <div
                      className="percentage-bar"
                      style={{ width: `${results[option] || 0}%` }}
                    ></div>
                    <span className="percentage-text">{results[option] || 0}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="poll-controls">
              <button 
                className="end-poll-btn" 
                onClick={endPoll}
                disabled={!canCreateNewPoll}
              >
                {canCreateNewPoll ? 'End Poll' : `Waiting for ${answerStatus.total - answerStatus.answered} more answers`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherView;