import React from 'react';
import { motion } from 'framer-motion';
import Header from '../components/common/Landing/Header';
import Hero from '../components/common/Landing/Hero';
import AboutPods from '../components/common/Landing/AboutPods';
import HowItWorks from '../components/common/Landing/HowItWorks';
import Features from '../components/common/Landing/Features';
import MissionVision from '../components/common/Landing/MissionVision';
import DownloadApp from '../components/common/Landing/DownloadApp';
import Footer from '../components/common/Landing/Footer';

const LandingPage = () => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white"
    >
      <Header />
      <main className="flex-1">
        <Hero />
        <AboutPods />
        <HowItWorks />
        <Features />
        <MissionVision />
        <DownloadApp />
      </main>
      <Footer />
    </motion.div>
  );
};

export default LandingPage; 