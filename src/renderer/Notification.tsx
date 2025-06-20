import React from 'react';

interface NotificationProps {
  message: string;
  type?: 'error' | 'info' | 'success' | 'warning';
  onClose: () => void;
}

const getColor = (type: string) => {
  switch (type) {
    case 'error': return '#f44336';
    case 'success': return '#4caf50';
    case 'warning': return '#ff9800';
    default: return '#2196f3';
  }
};

const Notification: React.FC<NotificationProps> = ({ message, type = 'info', onClose }) => {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 9999,
      background: getColor(type),
      color: '#fff',
      padding: '1em 2em',
      borderRadius: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      minWidth: 200,
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: 18, cursor: 'pointer' }}>&times;</button>
    </div>
  );
};

export default Notification;
