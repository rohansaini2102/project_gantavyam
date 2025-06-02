import React from 'react';

const DownloadApp = () => (
  <section className="py-16 px-4 bg-gradient-to-b from-sky-950 to-black text-white flex flex-col items-center">
    <h2 className="text-3xl md:text-4xl font-bold mb-6 text-sky-400">Get Started with Gantavyam</h2>
    <p className="text-lg md:text-xl text-sky-100 mb-8 text-center max-w-xl">
      Ready to experience smart, safe, and affordable rides? Join Gantavyam today and transform your daily commute.
    </p>
    <a href="/user/signup" className="inline-block bg-sky-400 text-black font-semibold px-8 py-4 rounded-full text-lg shadow-lg hover:bg-sky-500 transition">
      Get Started
    </a>
    {/* Uncomment below if you have app store links */}
    {/*
    <div className="flex gap-4 mt-6">
      <a href="#" className="inline-block"><img src="/appstore.png" alt="App Store" className="h-12" /></a>
      <a href="#" className="inline-block"><img src="/playstore.png" alt="Play Store" className="h-12" /></a>
    </div>
    */}
  </section>
);

export default DownloadApp; 