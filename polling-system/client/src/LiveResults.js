import React from 'react';

function LiveResults({ poll, results, onNewPoll }) {
  return (
    <div className="live-results">
      <h2>{poll.question}</h2>
      
      <div className="results-list">
        {poll.options.map((option, index) => (  // option is now a string
          <div key={index} className="result-item">
            <div className="option-text">
              <span>{option}</span>  {/* Directly render string */}
            </div>
            {/* ... rest of the code ... */}
          </div>
        ))}
      </div>
    </div>
  );
}

export default LiveResults;