import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', { // done 
    reconnection: true,
    reconnectionAttempts: Infinity,         
    reconnectionDelay: 1000,
    autoConnect: false
});

function StudentView() {

    //---------------------------------------------------state declaration---------------------------------------------------//
    const [name, setName] = useState('');
    const [nameSubmitted, setNameSubmitted] = useState(false);

    const [poll, setPoll] = useState(null);
    const [selectedOption, setSelectedOption] = useState('');
    const [results, setResults] = useState({});
    const [timeLeft, setTimeLeft] = useState(60);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [submissionState, setSubmissionState] = useState({
        isCorrect: null,
        submittedOption: null
    });
    const [participationStatus, setParticipationStatus] = useState({
        answered: 0,
        total: 0
    });
    const timerRef = useRef(null);

    //paticipation update
    const handleParticipationUpdate = (status) => {
        setParticipationStatus(status);
    };

    //---------------------------------------------------useEffect hooks---------------------------------------------------//
    // Initialize from session storage
    useEffect(() => {
        const savedName = sessionStorage.getItem('studentName');
        if (savedName) {
            setName(savedName);
            setNameSubmitted(true);
        }
    }, []);

    // listen for changes in participation status
    useEffect(() => {
        socket.on('participation-update', (status) => {
            setParticipationStatus(status);
        });
        return () => {
            socket.off('participation-update', handleParticipationUpdate);
        };
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
            const completePoll = {
                ...newPoll,
                correctAnswers: Array.isArray(newPoll.correctAnswers) ? newPoll.correctAnswers : []
            };
            setPoll(completePoll);
            setSelectedOption('');
            setResults({});
            setHasSubmitted(false);
            setSubmissionState({ isCorrect: null, submittedOption: null });
            setTimeLeft(Math.min(newPoll.timeLimit || 60, 60));

            if (timerRef.current) clearInterval(timerRef.current);

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
        socket.on('participation-update', handleParticipationUpdate);

        connectToSocket();

        return () => { //cleanup function
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('poll-created', handlePollCreated);
            socket.off('results-updated', handleResultsUpdated);
            socket.off('participation-update', handleParticipationUpdate);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [nameSubmitted, name]);

    //---------------------------------------------------event handlers---------------------------------------------------//

    // user_name (done)
    const handleNameSubmit = (e) => {
        e.preventDefault();
        if (name.trim().length >= 2) {
            sessionStorage.setItem('studentName', name.trim());
            setNameSubmitted(true);
        }
    };

    const handleNewTab = () => {
        sessionStorage.removeItem('studentName');
        window.open(window.location.href, '_blank');
    };

    //submit answer 
    const handleSubmitAnswer = () => {
        if (!selectedOption || !poll || !poll.correctAnswers) return;

        const isCorrect = poll.correctAnswers.includes(selectedOption);
        setSubmissionState({
            isCorrect,
            submittedOption: selectedOption
        });

        socket.emit('submit-answer', {
            answer: selectedOption,
            studentName: name,
            pollId: poll.question,
            isCorrect
        }, (response) => {
            if (response?.status === 'success') {
                setHasSubmitted(true);
                if (timerRef.current) clearInterval(timerRef.current);
                setTimeLeft(0);
            }
        });
    };

    

    //---------------------------------------------------rendering---------------------------------------------------//
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
                            {timeLeft <= 0 && (
                                <span className="participation-status">
                                    ({participationStatus.answered}/{participationStatus.total} students answered)
                                </span>
                            )}
                        </div>

                        <div className="options-grid">
                            {poll.options.map((option, index) => {
                                const isCorrectAnswer = poll.correctAnswers.includes(option);
                                const isSelected = selectedOption === option;
                                const showResults = timeLeft <= 0 || hasSubmitted;
                                const isSubmittedOption = submissionState.submittedOption === option;

                                let optionClass = 'option-btn';
                                if (isSelected) optionClass += ' selected';
                                if (showResults) {
                                    if (isCorrectAnswer) optionClass += ' correct';
                                    else if (isSubmittedOption && !submissionState.isCorrect) {
                                        optionClass += ' incorrect';
                                    }
                                }

                                return (
                                    <button
                                        key={index}
                                        className={optionClass}
                                        onClick={() => !hasSubmitted && timeLeft > 0 && setSelectedOption(option)}
                                        disabled={timeLeft <= 0 || hasSubmitted}
                                    >
                                        <span className="option-text">{option}</span>
                                        {showResults && isCorrectAnswer && (
                                            <span className="correct-indicator">✓ Correct</span>
                                        )}
                                        {showResults && isSubmittedOption && !submissionState.isCorrect && (
                                            <span className="incorrect-indicator">✗ Incorrect</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            className="submit-btn"
                            onClick={handleSubmitAnswer}
                            disabled={!selectedOption || timeLeft <= 0 || hasSubmitted}
                        >
                            {hasSubmitted ? 'Answer Submitted' :
                                timeLeft <= 0 ? 'Time Expired' : 'Submit Answer'}
                        </button>
                    </div>

                    {(Object.keys(results).length > 0 || timeLeft <= 0) && (
                        <div className="results-container">
                            <h3>Live Results</h3>
                            <div className="participation-summary">
                                {participationStatus.answered} of {participationStatus.total} students have answered
                            </div>
                            <div className="results-grid">
                                {poll.options.map((option, index) => (
                                    <div key={index} className="result-item">
                                        <div className="option-label">
                                            {option}
                                            {poll.correctAnswers.includes(option) && (
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