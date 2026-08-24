import { useState } from 'react';
import Head from 'next/head';
import { COUNTRIES, DESTINATIONS } from '../lib/countries';

const DOC_TYPES = [
  'Canadian PR card',
  'Canadian work permit',
  'Canadian visitor visa',
  'Canadian study permit',
  'US visa (B1/B2)',
  'US Green Card',
  'US work visa (H1B/L1)',
  'US student visa (F1)',
  'UK visa / residence permit',
  'UK Skilled Worker visa',
  'Schengen visa',
  'EU Blue Card',
  'Australian PR (permanent residency)',
  'Australian skilled/work visa',
  'New Zealand residency',
  'New Zealand work visa',
  'UAE residence visa',
  'UAE Golden Visa',
  'Saudi Arabia Iqama (residence permit)',
  'Qatar residence permit',
  'Kuwait residence permit',
  'Bahrain residence permit',
  'Oman residence permit',
  'Singapore PR',
  'Singapore Employment Pass',
  'Hong Kong visa',
  'Japan long-term resident visa',
  'South Korea F-visa (residency)',
  'Ireland residence permit',
  'Germany residence permit (Aufenthaltstitel)',
  'Other (type it in)',
];

const DOC_SUGGESTIONS = [
  'France Carte de séjour',
  'APEC Business Travel Card',
  'Refugee travel document',
  'Diplomatic/official passport endorsement',
  'Malaysia MM2H visa',
  'South Africa residence permit',
  'Switzerland residence permit',
  'Thailand Elite Visa',
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
    return <div className="result-card"><p>{res.message}</p></div>;
  }

  const verified = !!res.unlockedBy || res.baselineExhaustive;

  return (
    <div className="boarding-pass">
      <div className="bp-main">
        <h2>{res.result.destination_label}</h2>
        <div className="bp-grid">
          <div className="bp-item"><span className="k">Requirement</span><span className="v">{res.result.requirement}</span></div>
          <div className="bp-item"><span className="k">Fee</span><span className="v">{res.result.fee}</span></div>
          <div className="bp-item"><span className="k">Max stay</span><span className="v">{res.result.max_stay}</span></div>
          <div className="bp-item"><span className="k">Source</span><span className="v small">{res.result.source_name}</span></div>
        </div>

        {res.unlockedBy ? (
          <div className="unlock-badge">✓ Unlocked by your {res.unlockedBy}</div>
        ) : res.baselineExhaustive ? (
          <div className="unlock-badge">✓ Confirmed — passport nationality decides here</div>
        ) : (
          <div className="unlock-badge amber">
            ⚠ {res.source === 'live_search' ? 'Auto-researched just now' : 'Not yet fully verified'} — confirm before booking
          </div>
        )}

        {[res.documentWarning, res.passportWarning, res.purposeWarning, res.entryWarning, res.travelDateNote]
          .filter(Boolean)
          .map((msg, i) => <p key={i} className="warning-line">⚠ {msg}</p>)}

        <div className="feedback-row">
          <span>Was this accurate?</span>
          {voted ? (
            <span className="thanks">Thanks!</span>
          ) : (
            <>
              <button onClick={() => sendVote('up')}>👍</button>
              <button onClick={() => sendVote('down')}>👎</button>
            </>
          )}
        </div>
      </div>
      <div className="bp-stub">
        <div className="perf" />
        <div>
          <div className={`confidence ${verified ? 'verified' : 'auto'}`}>{verified ? 'Verified' : 'Auto-researched'}</div>
          <div className="confidence-date">{res.result.verified_date}</div>
        </div>
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

  function addDestination() { setDestEntries([...destEntries, newDestinationEntry()]); }
  function removeDestination(index) { setDestEntries(destEntries.filter((_, i) => i !== index)); }
  function updateDestField(index, field, value) {
    const updated = [...destEntries];
    updated[index] = { ...updated[index], [field]: value };
    setDestEntries(updated);
  }

  function addDocRow() { setDocRows([...docRows, { type: DOC_TYPES[0], custom: '', expiry: '' }]); }
  function removeDocRow(index) { setDocRows(docRows.filter((_, i) => i !== index)); }
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
      setResults(await Promise.all(promises));
    } catch (err) {
      setResults([{ found: false, message: 'Something went wrong. Try again.' }]);
    }
    setLoading(false);
  }

  return (
    <>
      <Head>
        <title>Passage — Know before you fly</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="hero">
        <div className="hero-inner">
          <p className="eyebrow">Passport + secondary documents, checked together</p>
          <h1>Your passport isn&apos;t the <em>whole</em> story.</h1>
          <p className="hero-sub">Tell us what else you hold and we&apos;ll tell you exactly what changes.</p>
        </div>
        <div className="stamp"><div className="stamp-text">ENTRY<span className="big">✓</span>CHECKED</div></div>
      </div>

      <main>
        <div className="section-label"><span className="num">1</span><h2>Your travel documents</h2></div>
        <div className="form-card">
          <div className="field">
            <label>Citizenship (passport held)</label>
            <select value={passportCountry} onChange={(e) => setPassportCountry(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="sub-field">
              <label className="small-label">Passport expiry date (optional)</label>
              <input type="date" value={passportExpiry} onChange={(e) => setPassportExpiry(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Other visas, residency or permits you hold</label>
            {docRows.map((row, i) => (
              <div key={i} className="doc-row-wrap">
                <div className="row">
                  <select value={row.type} onChange={(e) => updateDocRowType(i, e.target.value)}>
                    {DOC_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <button className="remove-btn" onClick={() => removeDocRow(i)}>×</button>
                </div>
                {row.type === 'Other (type it in)' && (
                  <input
                    type="text" list="doc-suggestions"
                    placeholder="e.g. Australian PR, UAE residence visa..."
                    value={row.custom} onChange={(e) => updateDocRowCustom(i, e.target.value)}
                    className="custom-doc-input"
                  />
                )}
                <div className="expiry-row">
                  <span className="small-label">Expiry (optional):</span>
                  <input type="date" value={row.expiry} onChange={(e) => updateDocRowExpiry(i, e.target.value)} />
                </div>
              </div>
            ))}
            <datalist id="doc-suggestions">
              {DOC_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
            <button className="add-btn" onClick={addDocRow}>+ Add another document</button>
          </div>
        </div>

        <div className="section-label"><span className="num">2</span><h2>Your trip</h2></div>
        <div className="form-card">
          <label className="stops-intro">Each stop can have its own purpose — transit through one, tourism in another</label>
          {destEntries.map((entry, i) => (
            <div key={i} className="stop-card">
              <div className="row">
                <select className="dest-select" value={entry.destination} onChange={(e) => updateDestField(i, 'destination', e.target.value)}>
                  {DESTINATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {destEntries.length > 1 && <button className="remove-btn" onClick={() => removeDestination(i)}>×</button>}
              </div>
              <div className="stop-fields">
                <div>
                  <label className="small-label">Purpose</label>
                  <select value={entry.purpose} onChange={(e) => updateDestField(i, 'purpose', e.target.value)}>
                    {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="small-label">Entry type</label>
                  <select value={entry.entryCount} onChange={(e) => updateDestField(i, 'entryCount', e.target.value)}>
                    {ENTRY_COUNTS.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
                  </select>
                </div>
                <div>
                  <label className="small-label">Date (optional)</label>
                  <input type="date" value={entry.travelDate} onChange={(e) => updateDestField(i, 'travelDate', e.target.value)} />
                </div>
              </div>
              {entry.purpose === 'Transit' && (
                <div className="transit-box">
                  <p>Transit rules are always shown as auto-researched, even for destinations we&apos;ve otherwise verified.</p>
                  <div className="stop-fields">
                    <div>
                      <label className="small-label">Leaving the airport?</label>
                      <select value={entry.leavingAirport} onChange={(e) => updateDestField(i, 'leavingAirport', e.target.value)}>
                        {LEAVING_AIRPORT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="small-label">Layover duration</label>
                      <select value={entry.layoverDuration} onChange={(e) => updateDestField(i, 'layoverDuration', e.target.value)}>
                        {LAYOVER_DURATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <button className="add-btn" onClick={addDestination}>+ Add another stop</button>

          <div className="submit-row">
            <button className="stamp-btn" onClick={handleCheck} disabled={loading}>
              {loading ? 'Checking…' : 'Stamp my check'}
            </button>
          </div>
        </div>

        {results && (
          <div className="results">
            <div className="section-label"><span className="num">3</span><h2>Results</h2></div>
            {results.map((res, i) => <ResultCard key={i} passportCountry={passportCountry} res={res} />)}
          </div>
        )}

        <p className="disclaimer">
          Verified destinations (UAE, UK, Schengen) use manually checked data assuming tourist, single-entry travel.
          Everything else is researched live when you search it. Always confirm with official government sources before booking travel.
        </p>
      </main>

      <footer>PASSAGE</footer>

      <style jsx global>{`
        :root {
          --ink:#1C2B45; --ink-2:#132038; --paper:#F6F1E3; --paper-2:#EDE4CC;
          --stamp-red:#A63A2E; --brass:#A9843C; --verified:#3C5A44; --verified-bg:#E4EBE0;
          --amber:#8A5A22; --amber-bg:#F3E7CF; --line:#C9BFA0;
        }
        * { box-sizing: border-box; }
        body { margin:0; background:var(--paper); color:var(--ink); font-family:'Inter',sans-serif; -webkit-font-smoothing:antialiased; }
        h1,h2,.serif { font-family:'Fraunces',serif; }
        select, input { font-family:'Inter',sans-serif; }
      `}</style>

      <style jsx>{`
        .hero { background:var(--ink); color:var(--paper); padding:72px 24px 64px; position:relative; overflow:hidden; }
        .hero-inner { max-width:760px; margin:0 auto; position:relative; z-index:2; }
        .eyebrow { font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#B7A98A; margin:0 0 16px; }
        .hero h1 { font-size:clamp(30px,5vw,48px); font-weight:600; line-height:1.08; margin:0 0 18px; }
        .hero h1 em { font-style:italic; font-weight:400; color:#D9B979; }
        .hero-sub { font-size:16px; line-height:1.6; color:#CBC3AE; max-width:520px; margin:0; }
        .stamp {
          position:absolute; top:44px; right:40px; width:110px; height:110px;
          border:2px solid #D9B979; border-radius:50%; display:flex; align-items:center; justify-content:center;
          transform:rotate(-12deg); opacity:.9;
        }
        .stamp-text { font-family:'IBM Plex Mono',monospace; color:#D9B979; text-align:center; font-size:9px; letter-spacing:.08em; line-height:1.4; }
        .stamp-text .big { font-size:15px; font-weight:600; display:block; margin:1px 0; }

        main { max-width:760px; margin:0 auto; padding:44px 24px 80px; }
        .section-label { display:flex; align-items:baseline; gap:12px; margin-bottom:16px; }
        .section-label .num {
          font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--brass);
          border:1px solid var(--brass); border-radius:50%; width:22px; height:22px;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .section-label h2 { font-size:20px; font-weight:600; margin:0; }

        .form-card { background:var(--paper-2); border:1px solid var(--line); border-radius:5px; padding:26px; margin-bottom:36px; }
        .field { margin-bottom:22px; }
        .field:last-child { margin-bottom:0; }
        label { display:block; font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:#6B6249; margin-bottom:7px; }
        .stops-intro { margin-bottom:16px; }
        .small-label { font-size:10.5px; color:#7A7259; margin-bottom:4px; text-transform:none; letter-spacing:0; }
        select, input[type=date], input[type=text] {
          width:100%; padding:10px 11px; background:var(--paper); border:none; border-bottom:2px solid var(--ink);
          font-size:14.5px; color:var(--ink); border-radius:2px 2px 0 0;
        }
        select:focus, input:focus { outline:2px solid var(--brass); outline-offset:1px; }
        .sub-field { margin-top:10px; max-width:320px; }

        .row { display:flex; gap:8px; margin-bottom:6px; }
        .row select { flex:1; }
        .dest-select { font-weight:600; }
        .remove-btn { background:none; border:1px solid var(--line); color:var(--amber); width:38px; border-radius:4px; cursor:pointer; font-size:16px; }
        .add-btn { margin-top:10px; background:none; border:1px dashed var(--brass); color:var(--ink); padding:9px 16px; border-radius:3px; font-family:'IBM Plex Mono',monospace; font-size:12px; cursor:pointer; }
        .doc-row-wrap { margin-bottom:14px; padding-bottom:14px; border-bottom:1px dashed var(--line); }
        .doc-row-wrap:last-of-type { border-bottom:none; }
        .custom-doc-input { margin-bottom:8px; }
        .expiry-row { display:flex; align-items:center; gap:8px; }
        .expiry-row input { width:auto; }

        .stop-card { border:1px solid var(--line); border-radius:5px; padding:16px; margin-bottom:12px; background:var(--paper); }
        .stop-fields { display:flex; gap:12px; flex-wrap:wrap; }
        .stop-fields > div { flex:1; min-width:130px; }
        .transit-box { margin-top:12px; padding:12px; background:var(--amber-bg); border:1px dashed var(--brass); border-radius:4px; }
        .transit-box p { font-family:'IBM Plex Mono',monospace; font-size:10.5px; color:var(--amber); margin:0 0 10px; text-transform:none; letter-spacing:0; }

        .submit-row { margin-top:22px; }
        .stamp-btn { background:var(--stamp-red); color:#F7F1E1; border:none; padding:14px 30px; font-family:'IBM Plex Mono',monospace; font-size:13px; letter-spacing:.08em; text-transform:uppercase; border-radius:3px; cursor:pointer; }
        .stamp-btn:disabled { opacity:.6; cursor:default; }

        .results { margin-top:8px; }
        .boarding-pass { position:relative; display:grid; grid-template-columns:1fr 150px; background:var(--paper-2); border:1px solid var(--line); border-radius:6px; margin-bottom:22px; overflow:hidden; }
        .bp-main { padding:22px 24px; }
        .bp-main h2 { font-size:22px; margin:0 0 14px; }
        .bp-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px 20px; margin-bottom:14px; }
        .bp-item .k { display:block; font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:#7A7259; margin-bottom:3px; }
        .bp-item .v { font-size:14.5px; font-weight:500; }
        .bp-item .v.small { font-size:12.5px; font-weight:400; }
        .unlock-badge { display:inline-flex; align-items:center; gap:6px; background:var(--verified-bg); color:var(--verified); border:1px solid #B7C7B0; padding:6px 12px; border-radius:16px; font-size:12.5px; margin-bottom:8px; }
        .unlock-badge.amber { background:var(--amber-bg); color:var(--amber); border-color:#D9C193; }
        .warning-line { margin-top:8px; padding:8px 10px; background:#FCEFEA; border:1px solid #E8A98F; border-radius:4px; color:var(--stamp-red); font-size:12.5px; }
        .feedback-row { margin-top:14px; display:flex; align-items:center; gap:8px; font-size:11.5px; color:#7A7259; }
        .feedback-row button { padding:3px 9px; cursor:pointer; border:1px solid var(--line); background:var(--paper); border-radius:4px; }
        .feedback-row .thanks { color:var(--verified); }

        .bp-stub { background:var(--ink); color:var(--paper); padding:20px 16px; display:flex; flex-direction:column; justify-content:space-between; position:relative; }
        .perf { position:absolute; left:0; top:12px; bottom:12px; border-left:2px dashed #4A5A78; }
        .confidence { font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.05em; text-transform:uppercase; }
        .confidence.verified { color:#9FD1A8; }
        .confidence.auto { color:#E0B97A; }
        .confidence-date { font-size:10.5px; color:#8695AC; margin-top:3px; }

        .disclaimer { margin-top:40px; font-size:12px; color:#7A7259; border-top:1px solid var(--line); padding-top:18px; line-height:1.6; }
        footer { text-align:center; padding:26px 24px 44px; font-family:'IBM Plex Mono',monospace; font-size:10.5px; color:#9A8F6E; letter-spacing:.08em; }

        @media (max-width:600px) {
          .boarding-pass { grid-template-columns:1fr; }
          .bp-stub::before { display:none; }
        }
      `}</style>
    </>
  );
}
