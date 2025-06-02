import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUser, FaCar, FaBars, FaTimes } from 'react-icons/fa';

const navLinks = [
  { href: '#', label: 'Home' },
  { href: '#about', label: 'About' },
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How It Works' },
  { href: '#mission', label: 'Mission' },
];

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const headerVariants = {
    initial: { y: -100 },
    animate: { 
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 20
      }
    }
  };

  const menuVariants = {
    closed: {
      opacity: 0,
      height: 0,
      transition: {
        duration: 0.3,
        when: "afterChildren"
      }
    },
    open: {
      opacity: 1,
      height: "auto",
      transition: {
        duration: 0.3,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };

  const menuItemVariants = {
    closed: { x: -20, opacity: 0 },
    open: { x: 0, opacity: 1 }
  };

  return (
    <motion.header
      variants={headerVariants}
      initial="initial"
      animate="animate"
      className={`fixed w-full top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg py-4' : 'bg-transparent py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.a 
            href="#"
            className="flex items-center gap-3"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-sky-600 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-lg">
                G
              </div>
              <div className="absolute -inset-1 bg-sky-400 rounded-xl blur-md opacity-30"></div>
            </div>
            <span className={`text-2xl font-bold tracking-tight ${
              scrolled ? 'text-gray-900' : 'text-gray-900'
            }`}>
              Gantavyam
            </span>
          </motion.a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <div className="flex gap-6">
              {navLinks.map((link) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  className={`font-medium transition-colors hover:text-sky-600 ${
                    scrolled ? 'text-gray-700' : 'text-gray-700'
                  }`}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {link.label}
                </motion.a>
              ))}
            </div>

            <div className="flex items-center gap-4 ml-8">
              <motion.a
                href="/user/login"
                className={`font-medium transition-colors ${
                  scrolled ? 'text-gray-700 hover:text-sky-600' : 'text-gray-700 hover:text-sky-600'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Login
              </motion.a>
              <motion.a
                href="/user/signup"
                className="bg-gray-900 text-white px-6 py-2.5 rounded-full font-medium hover:bg-gray-800 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Sign up
              </motion.a>
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <motion.button
            className="lg:hidden text-gray-900 text-2xl"
            onClick={() => setMenuOpen(!menuOpen)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {menuOpen ? <FaTimes /> : <FaBars />}
          </motion.button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              variants={menuVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="lg:hidden overflow-hidden mt-4"
            >
              <motion.div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
                {navLinks.map((link) => (
                  <motion.a
                    key={link.label}
                    href={link.href}
                    variants={menuItemVariants}
                    className="block text-gray-700 hover:text-sky-600 font-medium py-2 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </motion.a>
                ))}
                
                <motion.div 
                  variants={menuItemVariants}
                  className="pt-4 border-t border-gray-100 space-y-3"
                >
                  <motion.a
                    href="/user/login"
                    className="flex items-center gap-2 justify-center w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-full font-medium hover:bg-gray-50 transition-colors"
                    onClick={() => setMenuOpen(false)}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaUser /> I am a Rider
                  </motion.a>
                  <motion.a
                    href="/driver/login"
                    className="flex items-center gap-2 justify-center w-full bg-gray-900 text-white px-6 py-3 rounded-full font-medium hover:bg-gray-800 transition-colors"
                    onClick={() => setMenuOpen(false)}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaCar /> I am a Driver
                  </motion.a>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
};

export default Header;