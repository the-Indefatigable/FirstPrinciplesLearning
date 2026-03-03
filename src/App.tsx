import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import MathTools from './pages/MathTools';
import PhysicsTools from './pages/PhysicsTools';
import CSTools from './pages/CSTools';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/math" element={<MathTools />} />
        <Route path="/physics" element={<PhysicsTools />} />
        <Route path="/cs" element={<CSTools />} />
      </Routes>
    </BrowserRouter>
  );
}
