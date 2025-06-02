import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { FaMapSigns, FaStore, FaListOl, FaShieldAlt, FaRupeeSign, FaMobileAlt } from 'react-icons/fa';

const features = [
  { 
    icon: <FaMapSigns />, 
    title: 'Fixed Points', 
    desc: 'Service available at major metro and railway stations.',
    color: 'from-blue-400 to-blue-600'
  },
  { 
    icon: <FaStore />, 
    title: 'Physical Booths', 
    desc: 'On-ground support and queue management at every pod.',
    color: 'from-purple-400 to-purple-600'
  },
  { 
    icon: <FaListOl />, 
    title: 'Queue Management', 
    desc: 'Fair, transparent, and efficient user-driver matching.',
    color: 'from-green-400 to-green-600'
  },
  { 
    icon: <FaShieldAlt />, 
    title: 'Safety First', 
    desc: 'Safe rides with verified drivers and digital tracking.',
    color: 'from-red-400 to-red-600'
  },
  { 
    icon: <FaRupeeSign />, 
    title: 'Affordability', 
    desc: 'Pocket-friendly fares for everyone.',
    color: 'from-yellow-400 to-yellow-600'
  },
  { 
    icon: <FaMobileAlt />, 
    title: 'Digital Booking', 
    desc: 'Book rides easily via app or at the booth.',
    color: 'from-indigo-400 to-indigo-600'
  },
];

const FeatureCard = ({ feature, index }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className="group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-2xl transition-all duration-300 border border-gray-100 overflow-hidden"
    >
      {/* Gradient background on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Icon container */}
      <div className="relative mb-6">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.color} p-4 text-white text-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
          {feature.icon}
        </div>
        <div className={`absolute -inset-2 bg-gradient-to-r ${feature.color} rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-300`} />
      </div>

      {/* Content */}
      <h3 className="relative text-xl font-bold text-gray-900 mb-3 group-hover:text-gray-800 transition-colors">
        {feature.title}
      </h3>
      <p className="relative text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors">
        {feature.desc}
      </p>

      {/* Decorative element */}
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-gray-100 to-transparent rounded-tl-full opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
    </motion.div>
  );
};

const Features = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section id="features" className="py-24 px-4 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-20 left-0 w-64 h-64 bg-sky-100 rounded-full filter blur-3xl opacity-30" />
      <div className="absolute bottom-20 right-0 w-96 h-96 bg-purple-100 rounded-full filter blur-3xl opacity-20" />

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
            className="inline-flex items-center gap-2 bg-sky-100 text-sky-700 px-4 py-2 rounded-full text-sm font-medium mb-4"
          >
            <span className="w-2 h-2 bg-sky-500 rounded-full" />
            Why Choose Us
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Features that make us <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-sky-600">different</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            We combine the best of technology and on-ground support for a seamless, safe, and affordable last-mile experience.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <FeatureCard key={idx} feature={feature} index={idx} />
          ))}
        </div>

        {/* Call to action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-16"
        >
          <motion.a
            href="/user/signup"
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-8 py-4 rounded-full font-medium hover:bg-gray-800 transition-all group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Experience the difference
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
};

export default Features;