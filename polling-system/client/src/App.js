import React, { useState } from 'react';
import StudentView from './StudentView';
import TeacherView from './TeacherView';
import PollCreator from './PollCreator';
import './App.css';

function App() {
  const [role, setRole] = useState(null);

  return (
    <div className="app">
      {!role ? (
        <div className="role-selection">
          <h1>Welcome to the Live Polling System</h1>
          <p>Please select your role:</p>
          <div className="buttons">
            <button onClick={() => setRole('student')}>I'm a Student</button>
            <button onClick={() => setRole('teacher')}>I'm a Teacher</button>
          </div>
        </div>
      ) : role === 'student' ? (
        <StudentView />
      ) : (
        <TeacherView />
      )}
    </div>
  );
}


export default App;