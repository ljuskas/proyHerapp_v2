import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el punto de entrada de Heraap');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
