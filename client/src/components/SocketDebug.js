import React, { useEffect, useState } from 'react';
import { getSocket } from '../services/socket';

const SocketDebug = () => {
  const [socketInfo, setSocketInfo] = useState({});
  const [roomInfo, setRoomInfo] = useState('');

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Listen for room membership info
    socket.on('roomInfo', (data) => {
      setRoomInfo(JSON.stringify(data, null, 2));
    });

    // Request room info
    socket.emit('getRoomInfo');

    // Get socket connection info
    socket.on('connect', () => {
      setSocketInfo({
        id: socket.id,
        connected: socket.connected,
        auth: socket.auth
      });
    });

    return () => {
      socket.off('roomInfo');
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      width: 300,
      background: 'black',
      color: 'lime',
      padding: 10,
      fontFamily: 'monospace',
      fontSize: 12,
      borderRadius: 5,
      zIndex: 9999,
      maxHeight: 300,
      overflowY: 'auto'
    }}>
      <h3>Socket Debug</h3>
      <div>Socket ID: {socketInfo.id}</div>
      <div>Connected: {socketInfo.connected ? 'Yes' : 'No'}</div>
      <div>Room Info:</div>
      <pre>{roomInfo}</pre>
    </div>
  );
};

export default SocketDebug; 