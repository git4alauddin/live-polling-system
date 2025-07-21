import React from 'react';

function LiveResults({ poll, onNewPoll }) {
  // Mock data (replace with real data later)
  const results = [
    { option: 'Mars', percentage: 75 },
    { option: 'Venus', percentage: 5 },
    { option: 'Jupiter', percentage: 5 },
    { option: 'Saturn', percentage: 15 },
  ];

  return (
    <div className="live-results">
      <h2>{poll.question}</h2>
      
      <div className="results-list">
        {results.map((item, index) => (
          <div key={index} className="result-item">
            <div className="option-text">
              <input type="checkbox" checked={false} readOnly />
              <span>{item.option}</span>
            </div>
            <div className="percentage-bar-container">
              <div 
                className="percentage-bar" 
                style={{ width: `${item.percentage}%` }}
              ></div>
              <span className="percentage-text">{item.percentage}%</span>
            </div>
          </div>
        ))}
      </div>

      <button 
        className="new-poll-btn" 
        onClick={onNewPoll}
      >
        Ask a new question
      </button>
    </div>
  );
}

export default LiveResults;