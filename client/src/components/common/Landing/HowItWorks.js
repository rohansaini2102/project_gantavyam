import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { FaMapMarkerAlt, FaUsers, FaHandshake, FaTaxi } from 'react-icons/fa';

const steps = [
  {
    icon: <FaMapMarkerAlt />,
    title: 'Arrive at Pod',
    desc: 'Go to a Gantavyam booth at your nearest metro or railway station.',
    color: 'from-blue-400 to-blue-600'
  },
  {
    icon: <FaUsers />,
    title: 'Join the Queue',
    desc: 'Join the digital or physical queue managed by our staff.',
    color: 'from-purple-400 to-purple-600'
  },
  {
    icon: <FaHandshake />,
    title: 'Get Matched',
    desc: 'Get matched with a driver in a fair, streamlined manner.',
    color: 'from-green-400 to-green-600'
  },
  {
    icon: <FaTaxi />,
    title: 'Enjoy Your Ride',
    desc: 'Hop in and enjoy a safe, smart, and affordable journey.',
    color: 'from-orange-400 to-orange-600'
  }
];

const StepCard = ({ step, index }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.5, delay: index * 0.2 }}
      className="relative"
    >
      {/* Connection line */}
      {index < steps.length - 1 && (
        <div className="hidden md:block absolute top-20 left-full w-full h-0.5 bg-gradient-to-r from-gray-300 to-transparent">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 0.5, delay: index * 0.2 + 0.5 }}
            className="h-full bg-gradient-to-r from-sky-400 to-sky-600 origin-left"
          />
        </div>
      )}

      <motion.div
        whileHover={{ y: -10 }}
        className="relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 w-72"
      >
        {/* Step number */}
        <motion.div
          initial={{ scale: 0 }}
          animate={isInView ? { scale: 1 } : { scale: 0 }}
          transition={{ duration: 0.3, delay: index * 0.2 + 0.2 }}
          className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg z-10"
        >
          {index + 1}
        </motion.div>

        {/* Icon */}
        <div className="flex justify-center mt-6 mb-6">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
            className={`w-20 h-20 rounded-2xl bg-gradient-to-r ${step.color} p-5 text-white text-3xl flex items-center justify-center shadow-lg`}
          >
            {step.icon}
          </motion.div>
        </div>

        {/* Content */}
        <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">
          {step.title}
        </h3>
        <p className="text-gray-600 text-center leading-relaxed">
          {step.desc}
        </p>
      </motion.div>
    </motion.div>
  );
};

const HowItWorks = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section id="how" className="py-24 px-4 bg-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-sky-50 to-transparent rounded-full filter blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-50 to-transparent rounded-full filter blur-3xl" />

      <div ref={containerRef} className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : { scale: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-4"
          >
            <span className="w-2 h-2 bg-purple-500 rounded-full" />
            Simple Process
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            How It <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600">Works</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Getting a ride with Gantavyam is simple and straightforward
          </p>
        </motion.div>

        <div className="flex flex-col md:flex-row gap-12 md:gap-8 justify-center items-center">
          {steps.map((step, idx) => (
            <StepCard key={idx} step={step} index={idx} />
          ))}
        </div>

        {/* Mobile connection lines */}
        <div className="md:hidden flex flex-col items-center -mt-8">
          {steps.slice(0, -1).map((_, idx) => (
            <motion.div
              key={idx}
              initial={{ scaleY: 0 }}
              animate={isInView ? { scaleY: 1 } : { scaleY: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.2 + 0.5 }}
              className="w-0.5 h-16 bg-gradient-to-b from-gray-300 to-transparent"
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;