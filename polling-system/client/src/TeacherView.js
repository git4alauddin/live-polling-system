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
    const [students, setStudents] = useState(['Rahul Bajaj']);

    // Socket event handlers
    useEffect(() => {
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
        const selectedOptions = options
            .filter(opt => opt.checked && opt.text.trim())
            .map(opt => opt.text);

        if (!question.trim() || selectedOptions.length < 2) {
            alert('Please enter a question and at least 2 options');
            return;
        }

        const newPoll = {
            question,
            options: selectedOptions,
            timeLimit
        };

        socket.emit('create-poll', newPoll);
        setActivePoll(newPoll);
        setResults({});
    };

    const endPoll = () => {
        socket.emit('end-poll');
        setActivePoll(null);
    };

    return (
        <div className="teacher-view">
            {!activePoll ? (
                <div className="poll-creator">
                    <h1>Let's Get Started</h1>
                    <p>Create and manage polls in real-time</p>

                    <div className="form-group">
                        <label>Enter your question</label>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Is it Correct?"
                        />
                    </div>

                    <div className="form-group">
                        <label>Time limit (seconds)</label>
                        <input
                            type="number"
                            value={timeLimit}
                            onChange={(e) => setTimeLimit(Math.max(10, Math.min(300, e.target.value)))}
                            min="10"
                            max="300"
                        />
                    </div>

                    <div className="options-editor">
                        <label>Edit Options</label>
                        {options.map(option => (
                            <div key={option.id} className="option-item">
                                <input
                                    type="checkbox"
                                    checked={option.checked}
                                    onChange={() => toggleOption(option.id)}
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
                            + Add More option
                        </button>
                    </div>

                    <button className="submit-btn" onClick={createPoll}>
                        Ask Question
                    </button>
                </div>
            ) : (
                <div className="poll-results">
                    <h1>Question</h1>
                    <h2>{activePoll.question}</h2>

                    <div className="results-list">
                        {activePoll.options.map((option, index) => {
                            const percentage = results[option] || 0;
                            return (
                                <div key={index} className="result-item">
                                    <div className="option-info">
                                        <span className="option-text">{option}</span>
                                        <span className="percentage-value">{percentage}%</span>
                                    </div>
                                    <div className="percentage-bar-container">
                                        <div
                                            className="percentage-bar"
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="student-list">
                        <h3>Students Responded</h3>
                        <ul>
                            {students.map((student, index) => (
                                <li key={index}>{student}</li>
                            ))}
                        </ul>
                    </div>

                    <button className="new-poll-btn" onClick={endPoll}>
                        + Ask a new question
                    </button>
                </div>
            )}
        </div>
    );
}

export default TeacherView;