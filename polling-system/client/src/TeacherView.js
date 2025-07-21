import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import PollCreator from './PollCreator';
import LiveResults from './LiveResults';

const socket = io('http://localhost:4000');

function TeacherView() {
  const [activePoll, setActivePoll] = useState(null);
  const [results, setResults] = useState({});

  // Debug socket connection status
  useEffect(() => {
    console.log('[Teacher] Socket connection status:', {
      connected: socket.connected,
      id: socket.id
    });

    socket.on('connect', () => {
      console.log('✅ [Teacher] Socket connected with ID:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ [Teacher] Connection error:', err.message);
    });
  }, []);

  useEffect(() => {
    socket.on('results-updated', (data) => {
      console.log('[Teacher] Received results update:', data); // Debug results
      setResults(data);
    });
    return () => socket.off('results-updated');
  }, []);

  const handleCreatePoll = (poll) => {
    const formattedPoll = {
      question: poll.question,
      options: poll.options, // Should be array of strings
      timeLimit: poll.timeLimit
    };
    
    console.log('[Teacher] Emitting new poll:', formattedPoll); // Debug poll creation
    
    setActivePoll(formattedPoll);
    socket.emit('create-poll', formattedPoll, (acknowledgement) => {
      // Optional: Debug server acknowledgement
      console.log('[Teacher] Server acknowledgement:', acknowledgement);
    });
  };

  return (
    <div className="teacher-view">
      {!activePoll ? (
        <PollCreator onCreatePoll={handleCreatePoll} />
      ) : (
        <LiveResults 
          poll={activePoll} 
          results={results}
          onNewPoll={() => setActivePoll(null)} 
        />
      )}
    </div>
  );
}

export default TeacherView;