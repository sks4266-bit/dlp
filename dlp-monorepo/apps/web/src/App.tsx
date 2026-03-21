 import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
 import { useEffect } from 'react';
 import HomePage from './pages/HomePage';
 import UrgentPrayersPage from './pages/UrgentPrayersPage';
 import UrgentPrayerNewPage from './pages/UrgentPrayerNewPage';
 import LoginPage from './pages/auth/LoginPage';
 import RegisterPage from './pages/auth/RegisterPage';
 import { AuthProvider } from './auth/AuthContext';
 import { UiPrefsProvider } from './ui/UiPrefsContext';
 import MePage from './pages/MePage';
 import AdminPage from './pages/AdminPage';
 import DlpPage from './pages/DlpPage';
 import QtPage from './pages/QtPage';
 import ChannelsPage from './pages/ChannelsPage';
 import ChannelDetailPage from './pages/ChannelDetailPage';
 import McCheyneReadingPage from './pages/McCheyneReadingPage';
 import BiblePage from './pages/BiblePage';
 import BibleSearchPage from './pages/BibleSearchPage';
 import McheyneCalendarPage from './pages/McheyneCalendarPage';
 
 function RedirectToMe({ section }: { section: string }) {
   const nav = useNavigate();
   useEffect(() => {
     nav(`/me?section=${encodeURIComponent(section)}`, { replace: true });
   }, [nav, section]);
   return null;
 }
 
 export default function App() {
   return (
     <AuthProvider>
       <UiPrefsProvider>
+        <BrowserRouter>
+          <div className="appShell">
+            <div className="container">
+              <Routes>
+                <Route path="/" element={<HomePage />} />
+                <Route path="/urgent-prayers" element={<UrgentPrayersPage />} />
+                <Route path="/urgent-prayers/new" element={<UrgentPrayerNewPage />} />
+                <Route path="/login" element={<LoginPage />} />
+                <Route path="/register" element={<RegisterPage />} />
+                <Route path="/me" element={<MePage />} />
+                <Route path="/admin" element={<AdminPage />} />
+                <Route path="/dlp" element={<DlpPage />} />
+                <Route path="/gratitude" element={<RedirectToMe section="gratitude" />} />
+                <Route path="/qt" element={<QtPage />} />
+                <Route path="/channels" element={<ChannelsPage />} />
+                <Route path="/channels/:id" element={<ChannelDetailPage />} />
+                <Route path="/mcheyne-today" element={<McheyneTodayPage />} />
+                <Route path="/mcheyne-calendar" element={<McheyneCalendarPage />} />
+                <Route path="/bible" element={<BiblePage />} />
+                <Route path="/bible-search" element={<BibleSearchPage />} />
+              </Routes>
+            </div>
+          </div>
+        </BrowserRouter>
       </UiPrefsProvider>
     </AuthProvider>
   );
 }
