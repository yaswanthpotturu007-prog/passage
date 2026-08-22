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

const PURPOSES = ['Tourist', 'Business', 'Transit', 'Family visit'];
const ENTRY_COUNTS = ['Single entry', 'Multiple entry'];
const LEAVING_AIRPORT_OPTIONS = ['No, staying airside', 'Yes, leaving the airport'];
const LAYOVER_DURATIONS = ['Under 24 hours', '24+ hours'];

function newDestinationEntry() {
  return {
    destination: DESTINATIONS[0],
    purpose: 'Tourist',
    entryCount: 'Single entry',
    travelDate: '',
    leavingAirport: LEAVING_AIRPORT_OPTIONS[0],
    layoverDuration: LAYOVER_DURATIONS[0],
  };
}

function ResultCard({ passportCountry, res }) {
  const [voted, setVoted] = useState(null);

  async function sendVote(vote) {
    setVoted(vote);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passportCountry,
          destinationLabel: res.result?.destination_label,
          requirementText: res.result?.requirement,
          vote,
        }),
      });
    } catch (e) { /* fail silently - feedback is best-effort */ }
  }

  if (!res.found) {
    return <div style={{ padding: 24, border: '1px solid #ddd', borderRadius: 6, marginBottom: 20 }}><p>{res.message}</p></div>;
  }

  return (
    <div style={{ padding: 24, border: '1px solid #ddd', borderRadius: 6, marginBottom: 20 }}>
      <h2 style={{ marginTop: 0 }}>{res.result.destination_label}</h2>
      <p><strong>Requirement:</strong> {res.result.requirement}</p>
      <p><strong>Fee:</strong> {res.result.fee}</p>
      <p><strong>Max stay:</strong> {res.result.max_stay}</p>
      <p><strong>Source:</strong> {res.result.source_name}</p>

      {res.unlockedBy ? (
        <p style={{ color: '#3C5A44' }}>✓ Based on your {res.unlockedBy}</p>
      ) : res.baselineExhaustive ? (
        <p style={{ color: '#3C5A44' }}>✓ Confirmed: no document changes this — passport nationality decides here</p>
      ) : (
        <p style={{ color: '#B23A2F', fontWeight: 500 }}>
          ⚠ {res.source === 'live_search' ? 'Auto-researched just now' : 'Not yet fully verified'} — confirm with an official source before booking.
        </p>
      )}

      <p style={{ fontSize: 12, color: '#888' }}>
        Confidence: {res.result.confidence} · Last checked: {res.result.verified_date}
        {res.source === 'live_search' && ' · Found via live search'}
      </p>

      {[res.documentWarning, res.passportWarning, res.purposeWarning, res.entryWarning, res.travelDateNote]
        .filter(Boolean)
        .map((msg, i) => (
          <p key={i} style={{ marginTop: 10, padding: 10, background: '#FCEFEA', border: '1px solid #E8A98F', borderRadius: 4, color: '#A63A2E', fontSize: 13 }}>
            ⚠ {msg}
          </p>
        ))}

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: '#888' }}>Was this accurate?</span>
        {voted ? (
          <span style={{ fontSize: 12, color: '#3C5A44' }}>Thanks for the feedback!</span>
        ) : (
          <>
            <button onClick={() => sendVote('up')} style={{ padding: '4px 10px', cursor: 'pointer' }}>👍</button>
            <button onClick={() => sendVote('down')} style={{ padding: '4px 10px', cursor: 'pointer' }}>👎</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [passportCountry, setPassportCountry] = useState('India');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [destEntries, setDestEntries] = useState([newDestinationEntry()]);
  const [docRows, setDocRows] = useState([{ type: 'Canadian PR card', custom: '', expiry: '' }]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  function addDestination() {
    setDestEntries([...destEntries, newDestinationEntry()]);
  }
  function removeDestination(index) {
    setDestEntries(destEntries.filter((_, i) => i !== index));
  }
  function updateDestField(index, field, value) {
    const updated = [...destEntries];
    updated[index] = { ...updated[index], [field]: value };
    setDestEntries(updated);
  }

  function addDocRow() {
    setDocRows([...docRows, { type: DOC_TYPES[0], custom: '', expiry: '' }]);
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
  function updateDocRowExpiry(index, value) {
    const updated = [...docRows];
    updated[index] = { ...updated[index], expiry: value };
    setDocRows(updated);
  }
  function resolvedDocs() {
    return docRows
      .map((row) => ({
        name: row.type === 'Other (type it in)' ? row.custom.trim() : row.type,
        expiry: row.expiry || null,
      }))
      .filter((d) => d.name.length > 0);
  }

  async function handleCheck() {
    setLoading(true);
    setResults(null);
    try {
      const promises = destEntries.map((entry) =>
        fetch('/api/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passportCountry,
            passportExpiry: passportExpiry || null,
            destination: entry.destination,
            documents: resolvedDocs(),
            purpose: entry.purpose,
            entryCount: entry.entryCount,
            travelDate: entry.travelDate || null,
            leavingAirport: entry.purpose === 'Transit' ? entry.leavingAirport : null,
            layoverDuration: entry.purpose === 'Transit' ? entry.layoverDuration : null,
          }),
        }).then((r) => r.json())
      );
      const allResults = await Promise.all(promises);
      setResults(allResults);
    } catch (err) {
      setResults([{ found: false, message: 'Something went wrong. Try again.' }]);
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
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#888' }}>
            Passport expiry date (optional)
          </label>
          <input type="date" value={passportExpiry} onChange={(e) => setPassportExpiry(e.target.value)}
            style={{ padding: 8, border: '1px solid #ccc', borderRadius: 4 }} />
        </div>
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
                  placeholder="e.g. Australian PR, UAE residence visa..."
                  value={row.custom}
                  onChange={(e) => updateDocRowCustom(i, e.target.value)}
                  style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 4 }}
                />
              </div>
            )}
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 11, color: '#888' }}>Expiry (optional):</label>
              <input type="date" value={row.expiry} onChange={(e) => updateDocRowExpiry(i, e.target.value)}
                style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4, fontSize: 13 }} />
            </div>
          </div>
        ))}
        <datalist id="doc-suggestions">
          {DOC_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
        </datalist>
        <button onClick={addDocRow} style={{ marginTop: 4, padding: '8px 14px' }}>
          + Add another document
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 10, color: '#666' }}>
          Your trip — each stop can have its own purpose (e.g. transit through one, tourism in another)
        </label>

        {destEntries.map((entry, i) => (
          <div key={i} style={{ border: '1px solid #ddd', borderRadius: 6, padding: 16, marginBottom: 12, background: '#FAFAF8' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <select
                value={entry.destination}
                onChange={(e) => updateDestField(i, 'destination', e.target.value)}
                style={{ flex: 1, padding: 10, fontWeight: 600 }}
              >
                {DESTINATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {destEntries.length > 1 && (
                <button onClick={() => removeDestination(i)} style={{ padding: '0 14px' }}>×</button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#888' }}>Purpose</label>
                <select value={entry.purpose} onChange={(e) => updateDestField(i, 'purpose', e.target.value)} style={{ width: '100%', padding: 8 }}>
                  {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#888' }}>Entry type</label>
                <select value={entry.entryCount} onChange={(e) => updateDestField(i, 'entryCount', e.target.value)} style={{ width: '100%', padding: 8 }}>
                  {ENTRY_COUNTS.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#888' }}>Date (optional)</label>
                <input type="date" value={entry.travelDate} onChange={(e) => updateDestField(i, 'travelDate', e.target.value)}
                  style={{ width: '100%', padding: 7, border: '1px solid #ccc', borderRadius: 4 }} />
              </div>
            </div>

            {entry.purpose === 'Transit' && (
              <div style={{ marginTop: 12, padding: 12, background: '#FFF6D9', border: '1px dashed #D4B84A', borderRadius: 4 }}>
                <p style={{ fontSize: 11, color: '#7A6A1F', marginTop: 0, marginBottom: 8 }}>
                  Transit rules are always shown as auto-researched, even for destinations we&apos;ve otherwise verified.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#666' }}>Leaving the airport?</label>
                    <select value={entry.leavingAirport} onChange={(e) => updateDestField(i, 'leavingAirport', e.target.value)} style={{ width: '100%', padding: 8 }}>
                      {LEAVING_AIRPORT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#666' }}>Layover duration</label>
                    <select value={entry.layoverDuration} onChange={(e) => updateDestField(i, 'layoverDuration', e.target.value)} style={{ width: '100%', padding: 8 }}>
                      {LAYOVER_DURATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <button onClick={addDestination} style={{ marginTop: 4, padding: '8px 14px' }}>
          + Add another stop
        </button>
      </div>

      <button
        onClick={handleCheck}
        disabled={loading}
        style={{ background: '#A63A2E', color: 'white', border: 'none', padding: '14px 28px', borderRadius: 4, fontSize: 15, cursor: 'pointer' }}
      >
        {loading ? 'Checking…' : 'Stamp my check'}
      </button>

      {results && (
        <div style={{ marginTop: 40 }}>
          {results.map((res, i) => (
            <ResultCard key={i} passportCountry={passportCountry} res={res} />
          ))}
        </div>
      )}

      <p style={{ marginTop: 48, fontSize: 12, color: '#999' }}>
        Verified destinations (UAE, UK, Schengen) use manually checked data assuming tourist, single-entry travel.
        Everything else is researched live when you search it. Always confirm with official government sources before booking travel.
      </p>
    </div>
  );
}
