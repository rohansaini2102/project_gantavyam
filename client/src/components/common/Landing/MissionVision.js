import React from 'react';
import { FaBullseye, FaEye } from 'react-icons/fa';

const MissionVision = () => (
  <section id="mission" className="py-20 px-4 bg-white flex flex-col items-center">
    <h2 className="text-3xl md:text-4xl font-bold mb-8 text-sky-400">Our Mission & Vision</h2>
    <div className="flex flex-col md:flex-row gap-8 max-w-4xl w-full">
      <div className="flex-1 bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-6 md:mb-0 flex flex-col items-center">
        <FaBullseye className="text-sky-400 text-3xl mb-2" aria-label="Mission Icon" />
        <h3 className="text-2xl font-semibold text-gray-800 mb-2">Mission</h3>
        <p className="text-gray-700 text-center">
          Our Mission is to convert last mile connectivity system with international standard infrastructure and making available all the facilities regarding customer commute, hassle free.
        </p>
      </div>
      <div className="flex-1 bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col items-center">
        <FaEye className="text-sky-400 text-3xl mb-2" aria-label="Vision Icon" />
        <h3 className="text-2xl font-semibold text-gray-800 mb-2">Vision</h3>
        <p className="text-gray-700 text-center">
          To create the most compelling Last Mile Connectivity company of the 21st century by driving India's transition to a Developed Country.
        </p>
      </div>
    </div>
  </section>
);

export default MissionVision; 