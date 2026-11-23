import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { SiteSettingsProvider } from './contexts/SiteSettingsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthPage } from './pages/AuthPages';
import { EditProfilePage } from './pages/EditProfilePage';
import { ExplorePage } from './pages/ExplorePage';
import { FeedPage } from './pages/FeedPage';
import { HomePage } from './pages/HomePage';
import { AboutPage, ContactPage, PrivacyPage, TermsPage } from './pages/InfoPages';
import { MessagesPage } from './pages/MessagesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SavedPostsPage } from './pages/SavedPostsPage';
import { SettingsPage } from './pages/SettingsPage';
import { VideosPage } from './pages/VideosPage';
import { AdminAdsterraPage } from './pages/admin/AdminAdsterraPage';
import { AdminContentPage } from './pages/admin/AdminContentPage';
import { AdminCustomizationPage } from './pages/admin/AdminCustomizationPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLoginPage } from './pages/admin/AdminLayout';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SiteSettingsProvider>
          <ThemeProvider>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/login" element={<AuthPage mode="login" />} />
                <Route path="/register" element={<AuthPage mode="register" />} />
                <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
                <Route path="/profile/edit" element={<EditProfilePage />} />
                <Route path="/profile/:username" element={<ProfilePage />} />
                <Route path="/explore" element={<ExplorePage mode="explore" />} />
                <Route path="/trending" element={<ExplorePage mode="trending" />} />
                <Route path="/videos" element={<VideosPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/saved" element={<SavedPostsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/about" element={<AboutPage />} />

                {/* Separate Admin Console Routes */}
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/content" element={<AdminContentPage />} />
                <Route path="/admin/adsterra" element={<AdminAdsterraPage view="settings" />} />
                <Route path="/admin/monetization" element={<AdminAdsterraPage view="monetization" />} />
                <Route path="/admin/customization" element={<AdminCustomizationPage mode="design" />} />
                <Route path="/admin/settings" element={<AdminCustomizationPage mode="general" />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AuthProvider>
          </ThemeProvider>
        </SiteSettingsProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
