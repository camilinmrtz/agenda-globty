import React, { useEffect, useState } from 'react';

export function AvailabilityPanel({ apiUrl }) {
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchAvailability(); }, []);

  async function fetchAvailability() {
    if (!apiUrl) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl);
      const j = await res.json();
      setAvailability(j.availability || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  function toggleActive(i) {
    const copy = [...availability];
    copy[i].activo = !copy[i].activo;
    setAvailability(copy);
  }

  function setTime(i, field, value) {
    const copy = [...availability];
    copy[i][field] = value;
    setAvailability(copy);
  }

  async function save() {
    if (!apiUrl) return alert('No API URL configured');
    setLoading(true);
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability })
      });
      const j = await res.json();
      if (j.ok) alert('Disponibilidad guardada ✅'); else alert('Error: ' + JSON.stringify(j));
    } catch (err) { console.error(err); alert('Error guardando'); }
    setLoading(false);
  }

  return (
    <div style={{padding:12,border:'1px solid rgba(255,255,255,0.04)',borderRadius:8}}>
      <h3>Disponibilidad semanal</h3>
      {loading && <div>Cargando...</div>}
      {availability.map((r,i)=>(
        <div key={r.dia} style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
          <div style={{width:90}}>{r.dia}</div>
          <input type="time" value={r.desde} onChange={e => setTime(i,'desde',e.target.value)} />
          <input type="time" value={r.hasta} onChange={e => setTime(i,'hasta',e.target.value)} />
          <label><input type="checkbox" checked={!!r.activo} onChange={() => toggleActive(i)} /> activo</label>
        </div>
      ))}
      <div style={{marginTop:8}}>
        <button onClick={save} style={{padding:'8px 10px'}}>Guardar</button>
        <button onClick={fetchAvailability} style={{marginLeft:8}}>Re-cargar</button>
      </div>
    </div>
  );
}
