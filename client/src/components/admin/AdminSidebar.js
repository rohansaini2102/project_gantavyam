import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaUserPlus, FaUsers, FaCar, FaUser, FaHome, FaTachometerAlt, FaChartBar, FaCog, FaRoute, FaMapMarkerAlt, FaListOl, FaHandHoldingHeart, FaMoneyBillWave, FaBars, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useSidebar } from '../../contexts/SidebarContext';

const navLinks = [
  { to: '/admin', label: 'Dashboard', icon: <FaTachometerAlt />, isExact: true },
  {
    category: 'Operations',
    items: [
      { to: '/admin/rides', label: 'Ride Management', icon: <FaRoute /> },
      { to: '/admin/manual-booking', label: 'Manual Booking', icon: <FaHandHoldingHeart /> },
      { to: '/admin/queue', label: 'Queue Management', icon: <FaListOl /> },
      { to: '/admin/booths', label: 'Booth Management', icon: <FaMapMarkerAlt /> },
      { to: '/admin/fare-management', label: 'Fare Management', icon: <FaMoneyBillWave /> },
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
    category: 'Management',
    items: [
      { to: '/admin/register-driver', label: 'Register Driver', icon: <FaCar /> },
      { to: '/admin/add-user', label: 'Add User', icon: <FaUserPlus /> },
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
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [hoveredItem, setHoveredItem] = useState(null);

  const isActiveLink = (to, isExact = false) => {
    if (isExact) {
      return location.pathname === to;
    }
    return location.pathname.startsWith(to);
  };

  return (
    <aside className={`fixed left-0 top-0 bg-slate-800 text-white flex flex-col h-full z-40 transition-all duration-300 ease-in-out ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Brand */}
      <div className="border-b border-slate-700">
        <div className={`p-4 ${isCollapsed ? 'px-3' : 'p-6'}`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xl flex-shrink-0">
              G
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <h1 className="text-xl font-bold tracking-wide">GANTAVYAM</h1>
                <p className="text-xs text-slate-400">Admin Panel</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 overflow-y-auto overflow-x-hidden">
        <div className="space-y-6">
          {navLinks.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {section.category ? (
                <div className={isCollapsed ? 'px-2' : 'px-6'}>
                  {!isCollapsed && (
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      {section.category}
                    </h3>
                  )}
                  <ul className="space-y-1">
                    {section.items.map(link => (
                      <li key={link.to} className="relative">
                        <Link
                          to={link.to}
                          onMouseEnter={() => setHoveredItem(link.label)}
                          onMouseLeave={() => setHoveredItem(null)}
                          className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
                            isActiveLink(link.to, link.isExact)
                              ? 'bg-blue-600 text-white shadow-lg'
                              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          <span className={`${isCollapsed ? 'text-xl' : 'text-lg'} flex-shrink-0`}>{link.icon}</span>
                          {!isCollapsed && <span className="text-sm">{link.label}</span>}
                        </Link>

                        {/* Tooltip for collapsed state */}
                        {isCollapsed && hoveredItem === link.label && (
                          <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-slate-900 text-white text-sm px-2 py-1 rounded whitespace-nowrap z-50 shadow-lg">
                            {link.label}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className={`${isCollapsed ? 'px-2' : 'px-6'} relative`}>
                  <Link
                    to={section.to}
                    onMouseEnter={() => setHoveredItem(section.label)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
                      isActiveLink(section.to, section.isExact)
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span className={`${isCollapsed ? 'text-xl' : 'text-lg'} flex-shrink-0`}>{section.icon}</span>
                    {!isCollapsed && <span className="text-sm">{section.label}</span>}
                  </Link>

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && hoveredItem === section.label && (
                    <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-slate-900 text-white text-sm px-2 py-1 rounded whitespace-nowrap z-50 shadow-lg">
                      {section.label}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Toggle Button */}
      <div className="border-t border-slate-700 p-2">
        <button
          onClick={toggleSidebar}
          className={`w-full bg-blue-600 hover:bg-blue-500 text-white ${isCollapsed ? 'py-3' : 'py-2'} rounded-lg flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-lg`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <FaBars className={isCollapsed ? 'text-lg' : 'text-sm'} />
          {!isCollapsed && <span className="text-sm font-medium">Collapse</span>}
        </button>
      </div>

      {/* Footer */}
      <div className={`border-t border-slate-700 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {!isCollapsed ? (
          <div className="text-center">
            <p className="text-xs text-slate-400">&copy; 2025 GANTAVYAM</p>
            <p className="text-xs text-slate-500 mt-1">Admin Dashboard v1.0</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-xs text-slate-400">G</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AdminSidebar; 