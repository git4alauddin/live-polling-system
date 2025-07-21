import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  timeout: 20000,
  transports: ['websocket'],
  withCredentials: true
});

function StudentView() {
  const [poll, setPoll] = useState(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [results, setResults] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [name, setName] = useState('');
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Connection management
  useEffect(() => {
    if (!nameSubmitted) return;

    console.log('[Student] Initializing socket connection...');

    const onConnect = () => {
      console.log('✅ Connected to server with ID:', socket.id);
      setConnectionStatus('connected');
      socket.emit('register-student', { name });
      
      setTimeout(() => {
        if (!poll) {
          console.log('Requesting current poll...');
          socket.emit('request-poll', {}, (response) => {
            if (response?.question) {
              console.log('Received current poll:', response);
              setPoll(response);
              setTimeLeft(response.timeLimit);
            }
          });
        }
      }, 1000);
    };

    const onDisconnect = () => {
      console.log('⚠️ Disconnected from server');
      setConnectionStatus('disconnected');
    };

    const onPollCreated = (newPoll) => {
      console.log('📩 Received new poll:', newPoll);
      setPoll(newPoll);
      setTimeLeft(newPoll.timeLimit);
      setSelectedOption('');
      setResults({});
    };

    const onResultsUpdated = (newResults) => {
      console.log('📊 Results updated:', newResults);
      setResults(newResults);
    };

    const onPollEnded = () => {
      console.log('⏱️ Poll time ended');
      setTimeLeft(0);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('poll-created', onPollCreated);
    socket.on('results-updated', onResultsUpdated);
    socket.on('poll-ended', onPollEnded);
    socket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
      setConnectionStatus('error');
    });

    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('poll-created', onPollCreated);
      socket.off('results-updated', onResultsUpdated);
      socket.off('poll-ended', onPollEnded);
      socket.off('connect_error');
      socket.disconnect();
    };
  }, [nameSubmitted, name]);

  // Timer effect
  useEffect(() => {
    if (!poll || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [poll, timeLeft]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (name.trim().length >= 2) {
      setNameSubmitted(true);
    }
  };

  const handleSubmit = () => {
    if (!selectedOption || !name) return;
    
    socket.emit('submit-answer', { 
      answer: selectedOption,
      studentName: name
    }, (response) => {
      if (response?.error) {
        console.error('Submission error:', response.error);
      }
    });
  };

  if (!nameSubmitted) {
    return (
      <div className="name-prompt">
        <h2>Enter Your Name</h2>
        <form onSubmit={handleNameSubmit}>
          <input
            type="text"
            placeholder="Your name (min 2 characters)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={20}
            required
            autoFocus
          />
          <button type="submit" disabled={name.length < 2}>
            Join Classroom
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="student-view">
      {poll ? (
        <>
          <div className="poll-header">
            <h2>{poll.question}</h2>
            <div className="poll-meta">
              <span className="time-left">⏱️ {timeLeft}s remaining</span>
              <span className="student-name">👤 {name}</span>
            </div>
          </div>
          
          <div className="options-grid">
            {poll.options.map((option, index) => (
              <button
                key={index}
                className={`option-btn ${selectedOption === option ? 'selected' : ''}`}
                onClick={() => setSelectedOption(option)}
                disabled={timeLeft <= 0}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="action-bar">
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={!selectedOption || timeLeft <= 0}
            >
              {timeLeft <= 0 ? 'Time Expired' : 'Submit Answer'}
            </button>
          </div>

          {Object.keys(results).length > 0 && (
            <div className="results-container">
              <h3>Live Results</h3>
              <div className="results-grid">
                {poll.options.map((option, index) => (
                  <div key={index} className="result-item">
                    <div className="option-label">{option}</div>
                    <div className="result-bar-container">
                      <div 
                        className="result-bar" 
                        style={{ width: `${results[option] || 0}%` }}
                      />
                      <span className="percentage">{results[option] || 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="waiting-screen">
          <div className="connection-status">
            {connectionStatus === 'connected' ? (
              <>
                <div className="status-indicator connected" />
                <p>Connected as <strong>{name}</strong></p>
              </>
            ) : (
              <>
                <div className="status-indicator connecting" />
                <p>Connecting to classroom...</p>
              </>
            )}
          </div>
          <p className="waiting-message">Waiting for teacher to start a poll</p>
          <button 
            className="refresh-btn"
            onClick={() => window.location.reload()}
          >
            Refresh Connection
          </button>
        </div>
      )}
    </div>
  );
}

export default StudentView;