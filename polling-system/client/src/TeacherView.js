import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

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
  const [activeTab, setActiveTab] = useState('results');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Teacher authentication
  useEffect(() => {
    socket.emit('identify-teacher', 'teacher123', (response) => {
      if (response.error) {
        alert('Teacher authentication failed: ' + response.error);
      } else {
        setIsAuthenticated(true);
        console.log('Teacher authenticated successfully');
      }
    });

    socket.on('poll-created', (newPoll) => {
      setActivePoll(newPoll);
      setResults({});
      setCanCreateNewPoll(false);
      // Reset answer status when new poll is created
      setAnswerStatus(prev => ({ ...prev, answered: 0 }));
    });

    socket.on('results-updated', (newResults) => {
      setResults(newResults);
    });

    socket.on('student-joined', (studentName) => {
      setStudents(prev => [...prev, studentName]);
      setAnswerStatus(prev => ({ 
        ...prev, 
        total: prev.total + 1 
      }));
    });

    socket.on('student-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('student-kicked', (studentName) => {
      setStudents(prev => prev.filter(name => name !== studentName));
      setAnswerStatus(prev => ({
        answered: Math.max(0, prev.answered - 1),
        total: Math.max(0, prev.total - 1)
      }));
    });

    socket.on('all-students-answered', () => {
      setCanCreateNewPoll(true);
    });

    socket.on('poll-ended', () => {
      setActivePoll(null);
      setCanCreateNewPoll(true);
      setAnswerStatus(prev => ({ 
        answered: 0, 
        total: prev.total 
      }));
    });

    socket.on('answers-status', (status) => {
      setAnswerStatus(status);
      setCanCreateNewPoll(status.answered === status.total);
    });

    return () => {
      socket.off('poll-created');
      socket.off('results-updated');
      socket.off('student-joined');
      socket.off('student-message');
      socket.off('student-kicked');
      socket.off('all-students-answered');
      socket.off('poll-ended');
      socket.off('answers-status');
    };
  }, []);

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
      question,
      options: allOptions,
      correctAnswers,
      timeLimit
    };

    socket.emit('create-poll', newPoll, (response) => {
      if (response?.error) {
        alert('Failed to create poll: ' + response.error);
      } else {
        // Reset form after successful creation
        setQuestion('');
        setTimeLimit(60);
        setOptions([
          { id: 1, text: 'Yes', checked: false },
          { id: 2, text: 'No', checked: false }
        ]);
      }
    });
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        sender: 'Teacher',
        text: newMessage,
        timestamp: new Date().toLocaleTimeString()
      };
      socket.emit('teacher-message', message);
      setMessages([...messages, message]);
      setNewMessage('');
    }
  };

  const kickStudent = (studentName) => {
    if (window.confirm(`Are you sure you want to kick ${studentName}?`)) {
      socket.emit('kick-student', studentName);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-prompt">
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
                <div key={i} className={`message ${msg.sender === 'Teacher' ? 'teacher' : 'student'}`}>
                  <strong>{msg.sender}:</strong> {msg.text}
                  <span className="timestamp">{msg.timestamp}</span>
                </div>
              ))}
            </div>
            <div className="message-input">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="participants-list">
            <h3>Connected Students</h3>
            <ul>
              {students.map((student, i) => (
                <li key={i}>
                  <span>👤 {student}</span>
                  <button 
                    className="kick-btn"
                    onClick={() => kickStudent(student)}
                    title="Kick student"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
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
              />
            </div>

            <div className="form-group">
              <label>Time limit (seconds, 10-300)</label>
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
                </div>
              ))}
              <button className="add-option" onClick={addOption}>
                + Add Option
              </button>
            </div>

            <button 
              className="submit-btn" 
              onClick={createPoll}
              disabled={!canCreateNewPoll || !question.trim() || options.filter(opt => opt.text.trim()).length < 2}
            >
              {!canCreateNewPoll ? 
                `${answerStatus.answered}/${answerStatus.total} students answered` : 
                'Create Poll'}
            </button>
          </div>
        ) : (
          <div className="poll-results">
            <div className="poll-header">
              <h1>Live Poll Results</h1>
              <h2>{activePoll.question}</h2>
              <div className="poll-status">
                <div className="time-info">
                  ⏱️ {activePoll.timeLimit}s poll duration
                </div>
                <div className="answer-status">
                  {answerStatus.answered}/{answerStatus.total} students answered
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${(answerStatus.answered / answerStatus.total) * 100}%` }}
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

            <button className="end-poll-btn" onClick={endPoll}>
              End Poll and Create New
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherView;