import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import AdminPage from './pages/AdminPage';
import BiblePage from './pages/BiblePage';
import BibleSearchPage from './pages/BibleSearchPage';
import ChannelDetailPage from './pages/ChannelDetailPage';
import ChannelsPage from './pages/ChannelsPage';
import DlpPage from './pages/DlpPage';
import HomePage from './pages/HomePage';
import McCheyneReadingPage from './pages/McCheyneReadingPage';
import McheyneCalendarPage from './pages/McheyneCalendarPage';
import MePage from './pages/MePage';
import QtPage from './pages/QtPage';
import UrgentPrayerNewPage from './pages/UrgentPrayerNewPage';
import UrgentPrayersPage from './pages/UrgentPrayersPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

function RedirectToMe({ section }: { section: string }) {
  const nav = useNavigate();
  nav(`/me?section=${encodeURIComponent(section)}`);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="appShell">
          <div className="container">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/urgent-prayers" element={<UrgentPrayersPage />} />
              <Route
                path="/urgent-prayers/new"
                element={
                  <ProtectedRoute>
                    <UrgentPrayerNewPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route
                path="/me"
                element={
                  <ProtectedRoute>
                    <MePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dlp"
                element={
                  <ProtectedRoute>
                    <DlpPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/gratitude" element={<RedirectToMe section="gratitude" />} />
              <Route
                path="/qt"
                element={
                  <ProtectedRoute>
                    <QtPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/channels"
                element={
                  <ProtectedRoute>
                    <ChannelsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/channels/:id"
                element={
                  <ProtectedRoute>
                    <ChannelDetailPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/mcheyne-today"
                element={
                  <ProtectedRoute>
                    <McCheyneReadingPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/mcheyne-calendar" element={<McheyneCalendarPage />} />
              <Route path="/bible" element={<BiblePage />} />
              <Route path="/bible-search" element={<BibleSearchPage />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
