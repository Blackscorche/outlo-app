
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import ChatRooms from '@/pages/ChatRooms';
import ChatRoom from '@/pages/ChatRoom';
import ConnectionRequests from '@/pages/ConnectionRequests';
import Favorites from '@/pages/Favorites';
import Friends from '@/pages/Friends';
import NotFound from '@/pages/NotFound';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/profile/:userId?" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/chat" element={<ChatRooms />} />
              <Route path="/chat/:userId" element={<ChatRoom />} />
              <Route path="/connections" element={<ConnectionRequests />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          <Toaster />
        </Router>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
