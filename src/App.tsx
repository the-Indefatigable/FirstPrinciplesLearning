import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import ToolGallery from './pages/ToolGallery';
import ToolView from './pages/ToolView';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/math" element={<ToolGallery category="math" />} />
        <Route path="/physics" element={<ToolGallery category="physics" />} />
        <Route path="/cs" element={<ToolGallery category="cs" />} />
        <Route path="/math/:toolId" element={<ToolView />} />
        <Route path="/physics/:toolId" element={<ToolView />} />
        <Route path="/cs/:toolId" element={<ToolView />} />
      </Routes>
    </BrowserRouter>
  );
}
