import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaUserPlus, FaUsers, FaCar, FaUser, FaHome, FaTachometerAlt, FaChartBar, FaCog, FaRoute, FaMapMarkerAlt, FaListOl, FaHandHoldingHeart } from 'react-icons/fa';

const navLinks = [
  { to: '/admin', label: 'Dashboard', icon: <FaTachometerAlt />, isExact: true },
  { 
    category: 'Management',
    items: [
      { to: '/admin/register-driver', label: 'Register Driver', icon: <FaCar /> },
      { to: '/admin/add-user', label: 'Add User', icon: <FaUserPlus /> },
    ]
  },
  {
    category: 'Data',
    items: [
      { to: '/admin/drivers', label: 'All Drivers', icon: <FaUsers /> },
      { to: '/admin/view-users', label: 'All Users', icon: <FaUser /> },
    ]
  },
  {
    category: 'Operations',
    items: [
      { to: '/admin/rides', label: 'Ride Management', icon: <FaRoute /> },
      { to: '/admin/manual-booking', label: 'Manual Booking', icon: <FaHandHoldingHeart /> },
      { to: '/admin/queue', label: 'Queue Management', icon: <FaListOl /> },
      { to: '/admin/booths', label: 'Booth Management', icon: <FaMapMarkerAlt /> },
    ]
  },
  {
    category: 'System',
    items: [
      { to: '/admin/reports', label: 'Reports', icon: <FaChartBar /> },
      { to: '/admin/settings', label: 'Settings', icon: <FaCog /> },
    ]
  }
];

const AdminSidebar = () => {
  const location = useLocation();
  
  const isActiveLink = (to, isExact = false) => {
    if (isExact) {
      return location.pathname === to;
    }
    return location.pathname.startsWith(to);
  };

  return (
    <aside className="fixed left-0 top-0 w-64 bg-slate-800 text-white flex flex-col h-full z-40">
      {/* Brand */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xl">
            G
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">GANTAVYAM</h1>
            <p className="text-xs text-slate-400">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6">
        <div className="space-y-6">
          {navLinks.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {section.category ? (
                <div className="px-6">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    {section.category}
                  </h3>
                  <ul className="space-y-1">
                    {section.items.map(link => (
                      <li key={link.to}>
                        <Link
                          to={link.to}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
                            isActiveLink(link.to, link.isExact)
                              ? 'bg-blue-600 text-white shadow-lg'
                              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          <span className="text-lg">{link.icon}</span>
                          <span className="text-sm">{link.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="px-6">
                  <Link
                    to={section.to}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
                      isActiveLink(section.to, section.isExact)
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span className="text-lg">{section.icon}</span>
                    <span className="text-sm">{section.label}</span>
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-6 border-t border-slate-700">
        <div className="text-center">
          <p className="text-xs text-slate-400">&copy; 2025 GANTAVYAM</p>
          <p className="text-xs text-slate-500 mt-1">Admin Dashboard v1.0</p>
        </div>
      </div>
    </aside>
  );
};

export default AdminSidebar; 