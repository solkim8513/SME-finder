import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SMEList from './pages/SMEs/index';
import SMEForm from './pages/SMEs/SMEForm';
import SMEDetail from './pages/SMEs/SMEDetail';
import RequestList from './pages/Requests/index';
import NewRequest from './pages/Requests/NewRequest';
import RequestDetail from './pages/Requests/RequestDetail';
import RespondPage from './pages/Requests/RespondPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/respond/:token" element={<RespondPage />} />

      {/* Protected */}
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="smes" element={<SMEList />} />
        <Route path="smes/new" element={<SMEForm />} />
        <Route path="smes/:id" element={<SMEDetail />} />
        <Route path="smes/:id/edit" element={<SMEForm />} />
        <Route path="requests" element={<RequestList />} />
        <Route path="requests/new" element={<NewRequest />} />
        <Route path="requests/:id" element={<RequestDetail />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
