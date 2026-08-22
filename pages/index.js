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
  const [destinations, setDestinations] = useState([DESTINATIONS[0]]);
  const [docRows, setDocRows] = useState([{ type: 'Canadian PR card', custom: '', expiry: '' }]);
  const [purpose, setPurpose] = useState('Tourist');
  const [entryCount, setEntryCount] = useState('Single entry');
  const [travelDate, setTravelDate] = useState('');
  const [leavingAirport, setLeavingAirport] = useState(LEAVING_AIRPORT_OPTIONS[0]);
  const [layoverDuration, setLayoverDuration] = useState(LAYOVER_DURATIONS[0]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  function addDestination() {
    setDestinations([...destinations, DESTINATIONS[0]]);
  }
  function removeDestination(index) {
    setDestinations(destinations.filter((_, i) => i !== index));
  }
  function updateDestination(index, value) {
    const updated = [...destinations];
    updated[index] = value;
    setDestinations(updated);
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
      const promises = destinations.map((destination) =>
        fetch('/api/check', {
          method: 'POST',
          headers:
