import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import { UiPrefsProvider } from './ui/UiPrefsContext';
import AdminPage from './pages/AdminPage';
import BibleGamePage from './pages/BibleGamePage';
import BiblePage from './pages/BiblePage';
import BibleSearchPage from './pages/BibleSearchPage';
import ChannelDetailPage from './pages/ChannelDetailPage';
import ChannelsPage from './pages/ChannelsPage';
import DlpPage from './pages/DlpPage';
import GratitudePage from './pages/GratitudePage';
import HomePage from './pages/HomePage';
import McCheyneReadingPage from './pages/McCheyneReadingPage';
import McheyneCalendarPage from './pages/McheyneCalendarPage';
import MePage from './pages/MePage';
import PrivacyPage from './pages/PrivacyPage';
import QtPage from './pages/QtPage';
import SupportPage from './pages/SupportPage';
import TermsPage from './pages/TermsPage';
import UrgentPrayerNewPage from './pages/UrgentPrayerNewPage';
import UrgentPrayersPage from './pages/UrgentPrayersPage';
import AdminSupportPage from './pages/AdminSupportPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

export default function App() {
  return (
    <UiPrefsProvider>
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
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/support" element={<SupportPage />} />

                <Route
                  path="/me"
                  element={
                    <ProtectedRoute>
                      <MePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/gratitude"
                  element={
                    <ProtectedRoute>
                      <GratitudePage />
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
                  path="/admin/support"
                  element={
                    <ProtectedRoute>
                      <AdminSupportPage />
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
                <Route
                  path="/bible-game"
                  element={
                    <ProtectedRoute>
                      <BibleGamePage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </div>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </UiPrefsProvider>
  );
}
