import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './modules/auth/context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { AppRoutes } from './routes/AppRoutes';

export const App: React.FC = () => {
  // Warm-up silencioso de la API de Render para eliminar demoras de arranque en frío
  React.useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'https://avicolagr-api.carlos13soles.workers.dev/api/v1';
    fetch(`${apiUrl}/agent/status`).catch(() => {});
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <NotificationsProvider>
            <AppRoutes />
          </NotificationsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
