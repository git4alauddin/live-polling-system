import React, { useState } from 'react';
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

// Placeholder components (we'll implement these next)
function StudentView() {
  return <div>Student Interface - Coming Soon</div>;
}

function TeacherView() {
  return <div>Teacher Interface - Coming Soon</div>;
}

export default App;