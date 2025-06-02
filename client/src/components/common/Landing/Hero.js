import React from 'react';
import { motion } from 'framer-motion';
import { FaUser, FaCar, FaArrowRight } from 'react-icons/fa';

const Hero = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        damping: 20,
        stiffness: 100
      }
    }
  };

  return (
    <section className="relative overflow-hidden min-h-[85vh] flex items-center justify-center px-4 py-20">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-sky-50 -z-10" />
      
      {/* Animated background circles */}
      <motion.div
        className="absolute top-10 right-10 w-96 h-96 bg-sky-100 rounded-full filter blur-3xl opacity-60"
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          repeatType: "reverse"
        }}
      />
      <motion.div
        className="absolute bottom-10 left-10 w-72 h-72 bg-sky-200 rounded-full filter blur-3xl opacity-40"
        animate={{
          x: [0, -30, 0],
          y: [0, -50, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          repeatType: "reverse"
        }}
      />

      <motion.div 
        className="max-w-7xl mx-auto w-full z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="text-center">
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 bg-sky-100 text-sky-700 px-4 py-2 rounded-full text-sm font-medium mb-6"
          >
            <span className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
            India's first fixed-point auto rickshaw service
          </motion.div>

          <motion.h1 
            variants={itemVariants}
            className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight"
          >
            Go anywhere,<br />
            the <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-sky-600">smart way</span>
          </motion.h1>

          <motion.p 
            variants={itemVariants}
            className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Seamless, safe, and affordable rides from metro and railway stations. 
            No surge, no hassle—just last-mile convenience with <span className="font-semibold text-gray-800">Gantavyam</span>.
          </motion.p>

          <motion.div 
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
          >
            <motion.a 
              href="/user/login" 
              className="group relative flex items-center gap-3 bg-gray-900 text-white px-8 py-4 rounded-full text-lg font-medium overflow-hidden transition-all hover:bg-gray-800"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaUser className="z-10" />
              <span className="z-10">I am a Rider</span>
              <FaArrowRight className="z-10 transition-transform group-hover:translate-x-1" />
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-sky-400 to-sky-600"
                initial={{ x: "-100%" }}
                whileHover={{ x: 0 }}
                transition={{ type: "tween", duration: 0.3 }}
              />
            </motion.a>

            <motion.a 
              href="/driver/login" 
              className="group flex items-center gap-3 bg-white text-gray-900 px-8 py-4 rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all border border-gray-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaCar />
              <span>I am a Driver</span>
              <FaArrowRight className="transition-transform group-hover:translate-x-1" />
            </motion.a>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto"
          >
            {[
              { value: "50+", label: "Active Stations" },
              { value: "10K+", label: "Happy Riders" },
              { value: "4.8", label: "App Rating" }
            ].map((stat, index) => (
              <motion.div
                key={index}
                className="text-center"
                whileHover={{ y: -5 }}
              >
                <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
                <p className="text-gray-600 text-sm mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;