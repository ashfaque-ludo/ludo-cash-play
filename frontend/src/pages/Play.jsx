import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Play() {
  const navigate = useNavigate();
  const stakes = [50, 100, 200, 500, 1000];

  return (
    <div style={{minHeight: '100vh', background: 'linear-gradient(135deg, #4c1d95, #000, #4c1d95)', padding: '80px 20px'}}>
      <div style={{maxWidth: '1200px', margin: '0 auto'}}>
        
        <button
          onClick={() => navigate('/create-room')}
          style={{
            width: '100%',
            background: 'linear-gradient(90deg, #10b981, #06b6d4)',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            padding: '20px',
            borderRadius: '16px',
            border: 'none',
            cursor: 'pointer',
            marginBottom: '32px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}
        >
          ✨ CREATE CHALLENGE
        </button>

        <h2 style={{color: 'white', fontSize: '32px', marginBottom: '24px'}}>🎮 Stake Tables</h2>
        
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px'}}>
          {stakes.map(amt => (
            <div key={amt} style={{
              background: 'rgba(255,255,255,0.1)',
              border: '2px solid #06b6d4',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center'
            }}>
              <p style={{color: '#06b6d4', fontSize: '36px', fontWeight: 'bold', margin: '0 0 8px 0'}}>{amt}</p>
              <p style={{color: '#c4b5fd', fontSize: '14px', marginBottom: '16px'}}>Entry Fee</p>
              <button
                onClick={() => navigate(`/create-room?amount=${amt}`)}
                style={{
                  width: '100%',
                  background: '#ec4899',
                  color: 'white',
                  fontWeight: 'bold',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Create Room
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
