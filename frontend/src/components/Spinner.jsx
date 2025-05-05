// frontend/src/components/Spinner.jsx
import React from 'react';
import './Spinner.css';

// size: 'small', 'medium', 'large'
// message: Optional text to display below spinner
function Spinner({ size = 'medium', message }) {
  const spinnerClassName = `spinner spinner--${size}`;

  return (
    <div className="spinner-container" role="status" aria-live="polite">
      <div className={spinnerClassName} aria-hidden="true"></div>
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );
}

export default Spinner;