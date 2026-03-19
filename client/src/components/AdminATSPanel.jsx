import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import toast from 'react-hot-toast';
import api from '../services/api';

const AdminATSPanel = () => {
  const [weights, setWeights] = useState({
    keywordWeight: 40,
    skillsWeight: 30,
    experienceWeight: 20,
    formattingWeight: 10
  });
  
  const [thresholdScore, setThresholdScore] = useState(60);
  const [customKeywords, setCustomKeywords] = useState('');
  const [status, setStatus] = useState('');

  // Fetch current admin settings
  useEffect(() => {
    api.get('/admin-ats/ats-settings') // Example endpoint
      .then(res => res.data)
      .then(data => {
        if (data.weights) setWeights(data.weights);
        if (data.customKeywords) setCustomKeywords(data.customKeywords.join(', '));
        if (data.thresholdScore) setThresholdScore(data.thresholdScore);
      })
      .catch(err => console.error('Error fetching defaults:', err));
  }, []);

  const handleWeightChange = (e) => {
    setWeights({
      ...weights,
      [e.target.name]: parseInt(e.target.value) || 0
    });
  };

  const handleSave = async () => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (total !== 100) {
      toast.error(`Total weight must be 100. Currently: ${total}`);
      return;
    }

    try {
      const response = await api.post('/admin-ats/ats-settings', {
        weights,
        customKeywords: customKeywords.split(',').map(s => s.trim()).filter(Boolean),
        thresholdScore
      });

      if (response.status === 200) {
        toast.success('Settings successfully saved!');
      } else {
        toast.error('Failed to save settings.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error connecting to server.');
    }
  };

  return (
    <Layout title="ATS Scoring Configuration">
      <div style={{ padding: '2rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', maxWidth: '800px', margin: '2rem auto' }}>
        
        {/* Weights */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Scoring Weights <span style={{fontSize:'0.85rem', color: 'var(--text-muted)'}}>(Must equal 100%)</span></h3>
          
          {Object.keys(weights).map(key => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label style={{ textTransform: 'capitalize', color: 'var(--text-secondary)', width: '33%' }}>
                {key.replace('Weight', '')} Weight
              </label>
              <div style={{ display: 'flex', alignItems: 'center', width: '30%' }}>
                <input 
                  type="number"
                  name={key}
                  value={weights[key]}
                  onChange={handleWeightChange}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'right' }}
                  min="0" max="100"
                />
                <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}>%</span>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <span>Total Weight:</span>
            <span style={{ color: Object.values(weights).reduce((a, b) => a + b) !== 100 ? 'var(--danger)' : 'var(--success)' }}>
              {Object.values(weights).reduce((a, b) => a + b)}%
            </span>
          </div>
        </div>

        {/* Keywords */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Global Custom Keywords</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Comma-separated keywords prioritized in all ATS evaluations.</p>
          <textarea 
            rows="3"
            style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
            value={customKeywords}
            onChange={(e) => setCustomKeywords(e.target.value)}
            placeholder="e.g., Agile, Full Stack, Leadership"
          />
        </div>

        {/* Threshold */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Pass Threshold</h3>
          <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Minimum Acceptable ATS Score</label>
          <div style={{ display: 'flex', alignItems: 'center' }}>
              <input 
                type="range" 
                style={{ flex: 1, marginRight: '1.5rem' }} 
                min="0" max="100" 
                value={thresholdScore}
                onChange={(e) => setThresholdScore(Number(e.target.value))}
              />
              <span style={{ fontWeight: 'bold', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>{thresholdScore}%</span>
          </div>
        </div>

        <button onClick={handleSave} className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
          Save ATS Settings
        </button>
      </div>
    </Layout>
  );
};

export default AdminATSPanel;
