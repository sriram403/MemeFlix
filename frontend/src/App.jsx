import './App.css';
import Navbar from './components/Navbar'; // Import the Navbar component
import MemeGrid from './components/MemeGrid'; // Import the MemeGrid component

function App() {
  return (
    <div className="App">
      {/* Use the Navbar component */}
      <Navbar />

      <main>
        {/* Use the MemeGrid component */}
        <MemeGrid />
      </main>

      <footer>
        {/* Keep the simple footer for now */}
        <p>Memeflix Footer - All Rights Reserved (locally)</p>
      </footer>
    </div>
  );
}

export default App;