import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/',         label: 'Dashboard',    icon: '📊' },
  { to: '/smes',     label: 'SME Directory', icon: '👥' },
  { to: '/requests', label: 'Requests',      icon: '📋' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col min-h-screen">
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">SME Finder</h1>
        <p className="text-xs text-gray-400 mt-0.5">Proposal Team Tool</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
