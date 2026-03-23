import React from 'react';

const ATSScoreCard = ({ result }) => {
  if (!result) return null;

  const {
    atsScore,
    keywordMatch,
    skillsMatch,
    experienceMatch,
    relevanceScore,
    formattingScore,
    missingKeywords = [],
    suggestions = []
  } = result;

  const getColor = (score) => {
    if (score >= 80) return { color: 'var(--success)', bg: 'rgba(16,185,129,0.1)' };
    if (score >= 60) return { color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)' };
    return { color: 'var(--danger)', bg: 'rgba(239,68,68,0.1)' };
  };

  const getBarColor = (score) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
      
      {/* Header / Overall Score */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>ATS Resume Match</h2>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>Analyzed against provided Job Description</p>
        </div>
        <div style={{ 
            marginTop: '1rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            color: getColor(atsScore).color, 
            background: getColor(atsScore).bg, 
            border: `4px solid ${getColor(atsScore).color}` 
        }}>
          <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{atsScore}%</span>
        </div>
      </div>

      {/* Breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Keywords Match', score: keywordMatch },
          { label: 'Skills Alignment', score: skillsMatch },
          { label: 'Experience Level', score: experienceMatch },
          ...(relevanceScore !== undefined ? [{ label: 'Role Relevance', score: relevanceScore }] : []),
          { label: 'Formatting & Layout', score: formattingScore },
        ].map((item, idx) => (
          <div key={idx} style={{ background: 'var(--bg-dark)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.label}</span>
              <span style={{ fontWeight: 700, color: getColor(item.score).color }}>{item.score}%</span>
            </div>
            {/* Progress Bar */}
            <div style={{ width: '100%', background: 'var(--border)', borderRadius: '99px', height: '6px' }}>
              <div 
                style={{ width: `${item.score}%`, background: getBarColor(item.score), height: '100%', borderRadius: '99px' }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Actionable Feedback */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        
        {/* Missing Keywords */}
        <div style={{ padding: '1rem', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', borderRadius: 'var(--radius-sm)' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--danger)', fontSize: '1rem', display: 'flex', alignItems: 'center' }}>
            Missing Priority Keywords
          </h3>
          {missingKeywords.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {missingKeywords.map((kw, i) => (
                <span key={i} style={{ padding: '0.2rem 0.6rem', background: '#fff', border: '1px solid var(--border)', color: 'var(--danger)', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 500 }}>
                  {kw}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--success)', margin: 0, fontWeight: 500 }}>Great job! You hit the major keywords.</p>
          )}
        </div>

        {/* Suggestions */}
        <div style={{ padding: '1rem', border: '1px solid rgba(37,99,235,0.2)', background: 'rgba(37,99,235,0.05)', borderRadius: 'var(--radius-sm)' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--primary)', fontSize: '1rem', display: 'flex', alignItems: 'center' }}>
            Suggestions to Improve
          </h3>
          {suggestions.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {suggestions.map((suggestion, i) => (
                <li key={i} style={{ marginBottom: '0.25rem' }}>{suggestion}</li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--primary)', margin: 0, fontWeight: 500 }}>Your resume is perfectly tailored to this role!</p>
          )}
        </div>

      </div>

    </div>
  );
};

export default ATSScoreCard;
