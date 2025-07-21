import React, { useState } from 'react';

function PollCreator({ onCreatePoll }) {
  const [question, setQuestion] = useState('');
  const [timeLimit, setTimeLimit] = useState(60);
  const [options, setOptions] = useState([
    { text: 'Yes', checked: false },
    { text: 'No', checked: false },
  ]);

  const addOption = () => {
    setOptions([...options, { text: '', checked: false }]);
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...options];
    newOptions[index][field] = value;
    setOptions(newOptions);
  };

const submitPoll = () => {
  if (!question.trim()) {
    alert('Please enter a question!');
    return;
  }
  onCreatePoll({
    question,
    timeLimit,
    options: options.map(opt => opt.text).filter(text => text.trim()), // Fix: Extract only text
  });
};

  return (
    <div className="poll-creator">
      <h2>Let’s Get Started</h2>
      <p>Create and manage polls in real-time.</p>

      <div className="input-group">
        <label>Enter your question</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Is it Correct?"
        />
      </div>

      <div className="input-group">
        <label>Time limit (seconds)</label>
        <input
          type="number"
          value={timeLimit}
          onChange={(e) => setTimeLimit(e.target.value)}
          min="10"
        />
      </div>

      <div className="options-editor">
        <label>Edit Options</label>
        {options.map((opt, index) => (
          <div key={index} className="option-item">
            <input
              type="text"
              value={opt.text}
              onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
              placeholder={`Option ${index + 1}`}
            />
          </div>
        ))}
        <button onClick={addOption}>+ Add More option</button>
      </div>

      <button className="submit-btn" onClick={submitPoll}>
        Ask Question
      </button>
    </div>
  );
}

export default PollCreator;