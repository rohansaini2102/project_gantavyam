import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { FaCogs, FaCheckCircle, FaLightbulb } from 'react-icons/fa';

const AboutPods = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        damping: 20
      }
    }
  };

  const features = [
    "Smart digital technology integration",
    "Safe and verified driver network",
    "Transparent queue management",
    "Fixed-point convenience"
  ];

  return (
    <section id="about" className="py-24 px-4 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-40 -left-20 w-72 h-72 bg-sky-100 rounded-full filter blur-3xl opacity-30" />
      <div className="absolute bottom-20 -right-20 w-96 h-96 bg-purple-100 rounded-full filter blur-3xl opacity-20" />

      <motion.div 
        ref={ref}
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className="max-w-6xl mx-auto relative z-10"
      >
        {/* Section header */}
        <motion.div 
          variants={itemVariants}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : { scale: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-sky-100 text-sky-700 px-4 py-2 rounded-full text-sm font-medium mb-4"
          >
            <FaCogs className="text-lg" />
            Innovation Meets Tradition
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            About <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-sky-600">Future Pods</span>
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <motion.div variants={itemVariants}>
            <div className="space-y-6">
              <p className="text-lg text-gray-600 leading-relaxed">
                The next time you hop on a 3-wheeler, spare a thought to its history. 
                Our humble auto rickshaw is as old as 60 and has transformed into one 
                of the most reliable urban modes of transportation.
              </p>
              
              <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-2xl p-6 border border-sky-100">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <FaLightbulb className="text-2xl text-sky-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      What is a Future Pod?
                    </h3>
                    <p className="text-gray-700 leading-relaxed">
                      A revolutionary solution that infuses modern digital technology with 
                      traditional auto rickshaws, creating smart, safe, and pocket-friendly 
                      rides from fixed pods at major city locations.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {features.map((feature, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={isInView ? { x: 0, opacity: 1 } : { x: -20, opacity: 0 }}
                    transition={{ delay: 0.5 + idx * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <FaCheckCircle className="text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right visual */}
          <motion.div 
            variants={itemVariants}
            className="relative"
          >
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-3xl shadow-2xl p-8 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-sky-100 to-transparent rounded-bl-full" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-center mb-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="w-24 h-24 bg-gradient-to-br from-sky-400 to-sky-600 rounded-3xl flex items-center justify-center shadow-lg"
                  >
                    <FaCogs className="text-white text-4xl" />
                  </motion.div>
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                  Key Difference
                </h3>
                <p className="text-gray-600 text-center leading-relaxed">
                  Unlike other ride-hailing services, Gantavyam operates from 
                  <span className="font-semibold text-gray-800"> fixed points</span> like 
                  metro and railway stations, with 
                  <span className="font-semibold text-gray-800"> physical booths</span> that 
                  manage a streamlined flow and connect users to drivers in a fair, 
                  queue-based manner.
                </p>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="mt-6 text-center"
                >
                  <span className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-400 to-sky-600 text-white px-6 py-3 rounded-full font-medium">
                    Experience the Future
                  </span>
                </motion.div>
              </div>
            </motion.div>

            {/* Decorative elements */}
            <motion.div
              animate={{ 
                y: [0, -20, 0],
                rotate: [0, 10, 0]
              }}
              transition={{ 
                duration: 5,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-2xl shadow-lg opacity-80"
            />
            <motion.div
              animate={{ 
                y: [0, 20, 0],
                rotate: [0, -10, 0]
              }}
              transition={{ 
                duration: 7,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              className="absolute -bottom-6 -left-6 w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-2xl shadow-lg opacity-80"
            />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default AboutPods;