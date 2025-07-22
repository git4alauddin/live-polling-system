import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
// import './TeacherView.css';

const socket = io('http://localhost:4000');

function TeacherView() {
  const [question, setQuestion] = useState('');
  const [timeLimit, setTimeLimit] = useState(60);
  const [options, setOptions] = useState([
    { id: 1, text: 'Yes', checked: false },
    { id: 2, text: 'No', checked: false }
  ]);
  const [activePoll, setActivePoll] = useState(null);
  const [results, setResults] = useState({});
  const [students, setStudents] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Teacher authentication on component mount
  useEffect(() => {
    socket.emit('identify-teacher', 'teacher123', (response) => {
      if (response.error) {
        alert('Teacher authentication failed: ' + response.error);
      } else {
        setIsAuthenticated(true);
        console.log('Teacher authenticated successfully');
      }
    });

    socket.on('results-updated', (newResults) => {
      setResults(newResults);
    });

    socket.on('student-joined', (studentName) => {
      setStudents(prev => [...prev, studentName]);
    });

    return () => {
      socket.off('results-updated');
      socket.off('student-joined');
    };
  }, []);

  const endPoll = () => {
    socket.emit('end-poll', (response) => {
      if (response?.error) {
        alert('Failed to end poll: ' + response.error);
      } else {
        setActivePoll(null);
        setResults({});
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
        console.error('Poll creation failed:', response.error);
        alert('Failed to create poll: ' + response.error);
      } else {
        setActivePoll(newPoll);
        setResults({});
        setStudents([]);
      }
    });
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
                {!option.text.trim() && (
                  <span className="hint-text">(Enter text to enable)</span>
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
            <div className="time-info">
              ⏱️ {activePoll.timeLimit}s poll duration
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

          <div className="student-list">
            <h3>Participating Students ({students.length})</h3>
            <ul>
              {students.map((student, index) => (
                <li key={index}>
                  <span className="student-badge">👤</span> {student}
                </li>
              ))}
            </ul>
          </div>

          <button className="end-poll-btn" onClick={endPoll}>
            End Poll and Create New
          </button>
        </div>
      )}
    </div>
  );
}

export default TeacherView;