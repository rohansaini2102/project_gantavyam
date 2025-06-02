import React from 'react';

const Footer = () => (
  <footer className="w-full py-10 px-4 bg-black text-sky-200 flex flex-col md:flex-row md:items-start md:justify-between gap-8">
    <div className="mb-6 md:mb-0 flex-1">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-sky-400 rounded-full flex items-center justify-center font-bold text-black text-xl">G</div>
        <span className="text-sky-400 text-2xl font-bold tracking-wide ml-2">GANTAVYAM</span>
      </div>
      <div className="text-sm">&copy; {new Date().getFullYear()} Gantavyam. All rights reserved.</div>
    </div>
    <div className="flex-1 flex flex-col gap-2" aria-label="Footer Links">
      <span className="font-semibold text-white mb-1">Company</span>
      <a href="#about" className="hover:text-sky-400 transition">About</a>
      <a href="/help" className="hover:text-sky-400 transition">Help</a>
      <a href="#features" className="hover:text-sky-400 transition">Features</a>
      <a href="#mission" className="hover:text-sky-400 transition">Mission</a>
    </div>
    <div className="flex-1 flex flex-col gap-2" aria-label="Contact Links">
      <span className="font-semibold text-white mb-1">Contact</span>
      <a href="mailto:support@gantavyam.com" className="hover:text-sky-400 transition">support@gantavyam.com</a>
      <a href="#" className="hover:text-sky-400 transition">Twitter</a>
      <a href="#" className="hover:text-sky-400 transition">Facebook</a>
      <a href="#" className="hover:text-sky-400 transition">Instagram</a>
    </div>
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 bg-sky-400 text-black rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-sky-500 transition z-50"
      aria-label="Back to top"
    >
      ↑
    </button>
  </footer>
);

export default Footer; 