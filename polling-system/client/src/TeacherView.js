import React, { useState } from 'react';
import PollCreator from './PollCreator';
import LiveResults from './LiveResults';

function TeacherView() {
  const [activePoll, setActivePoll] = useState(null);

  return (
    <div className="teacher-view">
      {!activePoll ? (
        <PollCreator onCreatePoll={(poll) => setActivePoll(poll)} />
      ) : (
        <LiveResults 
          poll={activePoll} 
          onNewPoll={() => setActivePoll(null)} 
        />
      )}
    </div>
  );
}

export default TeacherView;