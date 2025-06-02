import React from 'react';

const AdminMain = ({ children }) => (
  <main className="flex-1 flex flex-col items-center justify-center p-8">
    <div className="w-full max-w-4xl mb-8">{children}</div>
  </main>
);

export default AdminMain; 