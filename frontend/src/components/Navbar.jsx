// frontend/src/components/Navbar.jsx
import React, { useState } from 'react'; // Import useState for local input state
import './Navbar.css';

// Receive onSearch prop from App.jsx
function Navbar({ onSearch }) {
  // Local state to hold the value currently typed into the input field
  const [inputValue, setInputValue] = useState('');

  // Handler for when the input value changes
  const handleInputChange = (event) => {
    setInputValue(event.target.value);
  };

  // Handler for when the search form (or button) is submitted
  const handleSearchSubmit = (event) => {
    event.preventDefault(); // Prevent default form submission (page reload)
    onSearch(inputValue);   // Call the onSearch prop passed from App.jsx
  };

  return (
    // Use a form element for better accessibility and handling Enter key
    <form className="navbar" onSubmit={handleSearchSubmit}>
      <div className="navbar-brand">Memeflix</div>
      <div className="navbar-links">
        <a href="#">Home</a>
        <a href="#">Trending</a>
      </div>
      {/* Search section now part of the form */}
      <div className="navbar-search">
        <input
          type="text"
          placeholder="Search memes..."
          value={inputValue} // Control the input value with state
          onChange={handleInputChange} // Update state on change
        />
        {/* Add a search button */}
        <button type="submit">Search</button>
      </div>
    </form>
  );
}

export default Navbar;