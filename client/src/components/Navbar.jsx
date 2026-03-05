import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {user?.first_name} {user?.last_name}
          <span className="ml-2 badge bg-blue-100 text-blue-700">{user?.role?.replace('_', ' ')}</span>
        </span>
        <button onClick={handleLogout} className="btn-secondary text-xs py-1">
          Sign out
        </button>
      </div>
    </header>
  );
}
