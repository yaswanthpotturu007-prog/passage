import { useState } from 'react';
import { COUNTRIES, DESTINATIONS } from '../lib/countries';

const DOC_TYPES = [
  'Canadian PR card',
  'Canadian work permit',
  'Canadian visitor visa',
  'US visa (B1/B2)',
  'US Green Card',
  'UK visa / residence permit',
  'Schengen visa',
  'Other (type it in)',
];

const DOC_SUGGESTIONS = [
  'Australian PR (permanent residency)',
  'New Zealand residency',
  'UAE residence visa',
  'Saudi Arabia Iqama (residence permit)',
  'Qatar residence permit',
  'Singapore Employment Pass',
  'Singapore PR',
  'Hong Kong visa',
  'Japan long-term resident visa',
  'South Korea F-visa (residency)',
  'Ireland residence permit',
  'Germany residence permit (Aufenthaltstitel)',
  'France Carte de séjour',
  'APEC Business Travel Card',
  'Refugee travel document',
  'Diplomatic/official passport endorsement',
];

export default function Home() {
  const [passportCountry, setPassportCountry] = useState('India');
  const [destination, setDestination] = useState(DESTINATIONS[0]);
  const [docRows, setDocRows] = useState([{ type: 'Canadian PR card', custom: '' }]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  function addDocRow() {
    setDocRows([...docRows, { type: DOC_TYPES[0], custom: '' }]);
  }
  function removeDocRow(index) {
    setDocRows(docRows.filter((_, i) => i !== index));
  }
  function updateDocRowType(index, value) {
    const updated = [...docRows];
    updated[index] = { ...updated[index], type: value };
    setDocRows(updated);
  }
  function updateDocRowCustom(index, value) {
    const updated = [...docRows];
    updated[index] = { ...updated[index], custom: value };
    setDocRows(updated);
  }
  function resolvedDocs() {
    return docRows
      .map((row) => (row.type === 'Other (type it in)' ? row.custom.trim() : row.type))
      .filter((v) => v.length > 0);
  }

  async function handleCheck() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passportCountry, destination, documents: resolvedDocs() }),
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
        <select value={passportCountry} onChange={(e) => setPassportCountry(e.target.value)} style={{ width: '100%', padding: 10 }}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#666' }}>
          Other visas, residency or permits you hold
        </label>
        {docRows.map((row, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={row.type} onChange={(e) => updateDocRowType(i, e.target.value)} style={{ flex: 1, padding: 10 }}>
                {DOC_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <button onClick={() => removeDocRow(i)} style={{ padding: '0 14px' }}>×</button>
            </div>
            {row.type === 'Other (type it in)' && (
              <div style={{ marginTop: 6 }}>
                <input
                  type="text"
                  list="doc-suggestions"
                  placeholder="e.g. Australian PR, UAE residence visa, Singapore Employment Pass..."
                  value={row.custom}
                  onChange={(e) => updateDocRowCustom(i, e.target.value)}
                  style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 4 }}
                />
                <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>
                  Start typing for suggestions, or enter anything not listed.
                </p>
              </div>
            )}
          </div>
        ))}
        <datalist id="doc-suggestions">
          {DOC_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
        </datalist>
        <button onClick={addDocRow} style={{ marginTop: 4, padding: '8px 14px' }}>
          + Add another document
        </button>
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#666' }}>
          Where are you going
        </label>
        <select value={destination} onChange={(e) => setDestination(e.target.value)} style={{ width: '100%', padding: 10 }}>
          {DESTINATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <button
        onClick={handleCheck}
        disabled={loading}
        style={{ background: '#A63A2E', color: 'white', border: 'none', padding: '14px 28px', borderRadius: 4, fontSize: 15, cursor: 'pointer' }}
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
              ) : result.baselineExhaustive ? (
                <p style={{ color: '#3C5A44' }}>✓ Confirmed: no document changes this — passport nationality decides here</p>
              ) : (
                <p style={{ color: '#B23A2F', fontWeight: 500 }}>
                  ⚠ {result.source === 'live_search' ? 'Auto-researched just now' : 'Not yet fully verified'} — confirm with an official source before booking.
                </p>
              )}

              <p style={{ fontSize: 12, color: '#888' }}>
                Confidence: {result.result.confidence} · Last checked: {result.result.verified_date}
                {result.source === 'live_search' && ' · Found via live search'}
              </p>
            </>
          )}
        </div>
      )}

      <p style={{ marginTop: 48, fontSize: 12, color: '#999' }}>
        Verified destinations (UAE, UK, Schengen) use manually checked data. Everything else is researched live
        when you search it. Always confirm with official government sources before booking travel.
      </p>
    </div>
  );
}
