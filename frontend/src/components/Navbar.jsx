import React from 'react'; // Import React (needed for JSX)
import './Navbar.css';    // We'll create this CSS file next

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        {/* We could put a logo here later */}
        Memeflix
      </div>
      <div className="navbar-links">
        {/* Add links later, e.g., Browse, Categories */}
        <a href="#">Home</a>
        <a href="#">Trending</a>
      </div>
      <div className="navbar-search">
        {/* Add search bar later */}
        <input type="text" placeholder="Search memes..." />
      </div>
    </nav>
  );
}

export default Navbar; // Make the component available for import elsewhere