import { useState } from 'react';

const DOC_TYPES = [
  'Canadian PR card',
  'Canadian work permit',
  'Canadian visitor visa',
  'US visa (B1/B2)',
  'US Green Card',
  'UK visa / residence permit',
  'Schengen visa',
];

const DESTINATIONS = [
  { value: 'uae', label: 'United Arab Emirates' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'schengen', label: 'Schengen Area' },
];

export default function Home() {
  const [destination, setDestination] = useState('uae');
  const [docRows, setDocRows] = useState(['Canadian PR card']);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  function addDocRow() {
    setDocRows([...docRows, DOC_TYPES[0]]);
  }

  function removeDocRow(index) {
    setDocRows(docRows.filter((_, i) => i !== index));
  }

  function updateDocRow(index, value) {
    const updated = [...docRows];
    updated[index] = value;
    setDocRows(updated);
  }

  async function handleCheck() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passportCountry: 'India',
          destination,
          documents: docRows,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ found: false, message: 'Something went wrong. Try again.' });
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 34, marginBottom: 8 }}>Passage</h1>
      <p style={{ color: '#555', marginBottom: 36 }}>
        Your passport isn&apos;t the whole story. Tell us what else you hold.
      </p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#666' }}>
          Citizenship (passport held)
        </label>
        <div style={{ padding: 10, background: '#f2f2f2', borderRadius: 4 }}>India</div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#666' }}>
          Other visas, residency or permits you hold
        </label>
        {docRows.map((doc, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select
              value={doc}
              onChange={(e) => updateDocRow(i, e.target.value)}
              style={{ flex: 1, padding: 10 }}
            >
              {DOC_TYPES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button onClick={() => removeDocRow(i)} style={{ padding: '0 14px' }}>×</button>
          </div>
        ))}
        <button onClick={addDocRow} style={{ marginTop: 4, padding: '8px 14px' }}>
          + Add another document
        </button>
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#666' }}>
          Where are you going
        </label>
        <select
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          style={{ width: '100%', padding: 10 }}
        >
          {DESTINATIONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleCheck}
        disabled={loading}
        style={{
          background: '#A63A2E',
          color: 'white',
          border: 'none',
          padding: '14px 28px',
          borderRadius: 4,
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        {loading ? 'Checking…' : 'Stamp my check'}
      </button>

      {result && (
        <div style={{ marginTop: 40, padding: 24, border: '1px solid #ddd', borderRadius: 6 }}>
          {!result.found ? (
            <p>{result.message}</p>
          ) : (
            <>
              <h2 style={{ marginTop: 0 }}>{result.result.destination_label}</h2>
              <p><strong>Requirement:</strong> {result.result.requirement}</p>
              <p><strong>Fee:</strong> {result.result.fee}</p>
              <p><strong>Max stay:</strong> {result.result.max_stay}</p>
              <p><strong>Source:</strong> {result.result.source_name}</p>
              {result.unlockedBy ? (
                <p style={{ color: '#3C5A44' }}>✓ Based on your {result.unlockedBy}</p>
              ) : (
                <p style={{ color: '#8A5A22' }}>Based on passport alone — none of your listed documents change this</p>
              )}
              <p style={{ fontSize: 12, color: '#888' }}>
                Confidence: {result.result.confidence} · Last checked: {result.result.verified_date}
              </p>
            </>
          )}
        </div>
      )}

      <p style={{ marginTop: 48, fontSize: 12, color: '#999' }}>
        This tool covers a limited set of destinations with manually verified data.
        Always confirm with official government sources before booking travel.
      </p>
    </div>
  );
}
