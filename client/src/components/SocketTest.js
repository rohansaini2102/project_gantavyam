import React, { useEffect, useState } from 'react';
import { getSocket } from '../services/socket';

const SocketTest = () => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    socket.on('connect', () => {
      setConnected(true);
      addMessage('Connected to server');
    });
    
    socket.on('disconnect', () => {
      setConnected(false);
      addMessage('Disconnected from server');
    });
    
    socket.on('newRideRequest', (data) => {
      addMessage(`New ride request: ${JSON.stringify(data)}`);
    });
    
    socket.on('rideAccepted', (data) => {
      addMessage(`Ride accepted: ${JSON.stringify(data)}`);
    });
    
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('newRideRequest');
      socket.off('rideAccepted');
    };
  }, []);
  
  const addMessage = (msg) => {
    setMessages(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };
  
  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      width: 300,
      height: 200,
      background: 'white',
      border: '1px solid #ccc',
      borderRadius: 8,
      padding: 10,
      overflowY: 'auto',
      fontSize: 12,
      fontFamily: 'monospace',
      zIndex: 9999
    }}>
      <div style={{
        marginBottom: 10,
        fontWeight: 'bold',
        color: connected ? 'green' : 'red'
      }}>
        Socket: {connected ? 'Connected' : 'Disconnected'}
      </div>
      <div>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: 5 }}>{msg}</div>
        ))}
      </div>
    </div>
  );
};

export default SocketTest; 