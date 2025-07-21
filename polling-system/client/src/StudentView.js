import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
// import './StudentView.css';

const socket = io('http://localhost:4000', {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  autoConnect: false
});

function StudentView() {
  const [name, setName] = useState('');
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [poll, setPoll] = useState(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [results, setResults] = useState({});
  const [timeLeft, setTimeLeft] = useState(60);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const timerRef = useRef(null);

  // Initialize from session storage
  useEffect(() => {
    const savedName = sessionStorage.getItem('studentName');
    if (savedName) {
      setName(savedName);
      setNameSubmitted(true);
    }
  }, []);

  // Socket connection and event handlers
  useEffect(() => {
    if (!nameSubmitted) return;

    const connectToSocket = () => {
      socket.connect();
      console.log('Connecting to server...');
    };

    const handleConnect = () => {
      console.log('✅ Connected to server with ID:', socket.id);
      setConnectionStatus('connected');
      socket.emit('register-student', { name });
    };

    const handleDisconnect = () => {
      console.log('⚠️ Disconnected from server');
      setConnectionStatus('disconnected');
    };

    const handlePollCreated = (newPoll) => {
      console.log('📩 Received new poll:', newPoll);
      // Ensure poll has correctAnswers array
      const completePoll = {
        ...newPoll,
        correctAnswers: newPoll.correctAnswers || []
      };
      setPoll(completePoll);
      setSelectedOption('');
      setResults({});
      setTimeLeft(Math.min(newPoll.timeLimit || 60, 60));
      
      // Clear any existing timer
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Start new timer
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const handleResultsUpdated = (newResults) => {
      console.log('📊 Results updated:', newResults);
      setResults(newResults);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('poll-created', handlePollCreated);
    socket.on('results-updated', handleResultsUpdated);

    connectToSocket();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('poll-created', handlePollCreated);
      socket.off('results-updated', handleResultsUpdated);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [nameSubmitted, name]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (name.trim().length >= 2) {
      sessionStorage.setItem('studentName', name.trim());
      setNameSubmitted(true);
    }
  };

  const handleSubmitAnswer = () => {
    if (!selectedOption || !poll) return;
    
    socket.emit('submit-answer', {
      answer: selectedOption,
      studentName: name,
      pollId: poll.question
    });
    
    // Clear timer since student has submitted
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(0);
  };

  const handleNewTab = () => {
    sessionStorage.removeItem('studentName');
    window.open(window.location.href, '_blank');
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
      <div className="student-header">
        <span className="student-name">👤 {name}</span>
        <button className="new-tab-btn" onClick={handleNewTab}>
          Join as New Student
        </button>
      </div>

      {poll ? (
        <>
          <div className="poll-container">
            <h2 className="poll-question">{poll.question}</h2>
            <div className="time-left">
              ⏱️ {timeLeft > 0 ? `${timeLeft}s remaining` : 'Time expired'}
            </div>

            <div className="options-grid">
              {poll.options.map((option, index) => (
                <button
                  key={index}
                  className={`option-btn ${
                    selectedOption === option ? 'selected' : ''
                  } ${
                    timeLeft <= 0 && poll.correctAnswers?.includes(option) ? 'correct' : ''
                  }`}
                  onClick={() => timeLeft > 0 && setSelectedOption(option)}
                  disabled={timeLeft <= 0}
                >
                  <span className="option-text">{option}</span>
                  {timeLeft <= 0 && poll.correctAnswers?.includes(option) && (
                    <span className="correct-indicator">✓</span>
                  )}
                </button>
              ))}
            </div>

            <button
              className="submit-btn"
              onClick={handleSubmitAnswer}
              disabled={!selectedOption || timeLeft <= 0}
            >
              {timeLeft <= 0 ? 'Time Expired' : 'Submit Answer'}
            </button>
          </div>

          {(Object.keys(results).length > 0 || timeLeft <= 0) && (
            <div className="results-container">
              <h3>Live Results</h3>
              <div className="results-grid">
                {poll.options.map((option, index) => (
                  <div key={index} className="result-item">
                    <div className="option-label">
                      {option}
                      {poll.correctAnswers?.includes(option) && (
                        <span className="correct-tag"> (Correct)</span>
                      )}
                    </div>
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
                <p>Connected to classroom</p>
              </>
            ) : (
              <>
                <div className="status-indicator connecting" />
                <p>Connecting to classroom...</p>
              </>
            )}
          </div>
          <p>Waiting for teacher to start a poll</p>
        </div>
      )}
    </div>
  );
}

export default StudentView;