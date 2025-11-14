import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
} from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';

export default function InterviewSchedulerGlobty({ clientId, apiKey, availabilityApiUrl }) {
  const getSafeEnv = () => {
    const fromProcess = typeof process !== 'undefined' && process?.env ? process.env : null;
    const fromWindow = typeof window !== 'undefined' && window.__ENV ? window.__ENV : null;
    return {
      CLIENT_ID: clientId || (fromProcess && fromProcess.REACT_APP_GOOGLE_CLIENT_ID) || (fromWindow && fromWindow.REACT_APP_GOOGLE_CLIENT_ID) || '',
      API_KEY: apiKey || (fromProcess && fromProcess.REACT_APP_GOOGLE_API_KEY) || (fromWindow && fromWindow.REACT_APP_GOOGLE_API_KEY) || '',
      AVAILABILITY_API: availabilityApiUrl || (fromWindow && fromWindow.AVAILABILITY_API_URL) || '',
    };
  };

  const env = getSafeEnv();
  const CLIENT_ID = env.CLIENT_ID;
  const AVAILABILITY_API = env.AVAILABILITY_API;

  const [gsiLoaded, setGsiLoaded] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ summary: '', guests: '', start: new Date(), end: addDays(new Date(), 0), description: '' });
  const [monthStart, setMonthStart] = useState(startOfMonth(new Date()));
  const [statusMsg, setStatusMsg] = useState('');
  const [availability, setAvailability] = useState([]);
  const [freeSlots, setFreeSlots] = useState([]);
  const SLOT_MINUTES = 30;
  const [connectedCalendars, setConnectedCalendars] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.google && window.google.accounts) {
      setGsiLoaded(true);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => setGsiLoaded(true);
    document.body.appendChild(s);
    return () => { if (s.parentNode) s.parentNode.removeChild(s); };
  }, []);

  useEffect(() => {
    if (!gsiLoaded) return;
    if (!CLIENT_ID) {
      console.warn('No CLIENT_ID configured.');
      return;
    }
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      console.error('GSI not loaded');
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) { setStatusMsg('Error auth'); console.error(resp); return; }
        setAccessToken(resp.access_token);
        setStatusMsg('Conectado');
        fetchCalendarList(resp.access_token);
      },
    });
    setTokenClient(client);
  }, [gsiLoaded, CLIENT_ID]);

  useEffect(() => {
    if (AVAILABILITY_API) {
      fetch(AVAILABILITY_API).then(r => r.json()).then(j => { setAvailability(j.availability || []); }).catch(console.error);
    } else {
      // default availability: Mon-Fri 10-11 and 15-17
      const days = ['Lunes','Martes','Mié','Jue','Vie'];
      setAvailability(days.map(d => ({ dia: d, desde: d.includes('S')? '': '10:00', hasta: d.includes('S')? '': '17:00', activo: true })));
    }
  }, [AVAILABILITY_API]);

  useEffect(() => {
    if (accessToken) fetchEventsForDate(selectedDate);
  }, [accessToken, selectedDate]);

  async function signIn() {
    if (!tokenClient) return alert('Token client no inicializado.');
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  async function signOut() {
    setAccessToken(null); setEvents([]); setStatusMsg('Desconectado');
    if (accessToken) await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, { method: 'POST', headers: { 'Content-type': 'application/x-www-form-urlencoded' } });
  }

  async function fetchCalendarList(token) {
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', { headers: { Authorization: `Bearer ${token}` }});
      const j = await res.json();
      const ids = (j.items || []).map(it => ({ id: it.id, summary: it.summary, selected: false }));
      setConnectedCalendars(ids);
    } catch (err) { console.error(err); }
  }

  async function fetchEventsForDate(date) {
    if (!accessToken) return;
    const timeMin = new Date(date); timeMin.setHours(0,0,0,0);
    const timeMax = new Date(date); timeMax.setHours(23,59,59,999);
    const calendarsToQuery = connectedCalendars.filter(c => c.selected).map(c => c.id);
    if (calendarsToQuery.length === 0) calendarsToQuery.push('primary');

    const allEvents = [];
    for (const calId of calendarsToQuery) {
      const q = new URLSearchParams({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: 'true', orderBy: 'startTime' });
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${q.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` }});
      if (res.ok) {
        const data = await res.json();
        if (data.items) allEvents.push(...data.items);
      }
    }
    setEvents(allEvents);
    computeFreeSlots(date, allEvents);
  }

  function parseTimeToDate(baseDate, timeStr) {
    const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
    const d = new Date(baseDate);
    d.setHours(hh||0, mm||0, 0, 0);
    return d;
  }
  function generateSlotsForDay(date, desdeStr, hastaStr, slotMinutes=30) {
    const start = parseTimeToDate(date, desdeStr);
    const end = parseTimeToDate(date, hastaStr);
    const slots = [];
    for (let t = new Date(start); t.getTime() + slotMinutes*60000 <= end.getTime(); t = new Date(t.getTime() + slotMinutes*60000)) {
      slots.push(new Date(t));
    }
    return slots;
  }
  function slotConflicts(slotStart, eventsList, slotMinutes=30) {
    const slotEnd = new Date(slotStart.getTime() + slotMinutes*60000);
    for (const ev of eventsList) {
      const evStart = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : null;
      const evEnd = ev.end?.dateTime ? new Date(ev.end.dateTime) : ev.end?.date ? new Date(ev.end.date) : null;
      if (!evStart || !evEnd) continue;
      if (slotStart < evEnd && slotEnd > evStart) return true;
    }
    return false;
  }

  function computeFreeSlots(date, eventsList) {
    const weekDayName = format(date, 'EEEE');
    const candidates = availability.filter(a => {
      const d = (a.dia || '').toString().toLowerCase();
      return d.includes(weekDayName.toLowerCase()) || d.includes(translateWeekday(weekDayName).toLowerCase());
    });
    if (candidates.length === 0) { setFreeSlots([]); return; }

    const slots = [];
    for (const cand of candidates) {
      if (!cand.activo) continue;
      // handle the fixed config the user requested: two windows 10-11 and 15-17
      // prefer using cand.desde/hasta if provided
      const desde = cand.desde && cand.desde.length>0 ? cand.desde : (cand.dia ? '10:00' : '10:00');
      const hasta = cand.hasta && cand.hasta.length>0 ? cand.hasta : (cand.dia ? '17:00' : '17:00');
      // but we only want slots within 10-11 and 15-17 per user's choice
      const daySlots1 = generateSlotsForDay(date, '10:00', '11:00', SLOT_MINUTES);
      const daySlots2 = generateSlotsForDay(date, '15:00', '17:00', SLOT_MINUTES);
      const daySlots = daySlots1.concat(daySlots2);
      for (const s of daySlots) {
        if (!slotConflicts(s, eventsList, SLOT_MINUTES)) slots.push(s);
      }
    }
    setFreeSlots(slots);
  }

  function translateWeekday(eng) {
    const map = { Monday:'Lunes', Tuesday:'Martes', Wednesday:'Mié', Thursday:'Jue', Friday:'Vie', Saturday:'Sáb', Sunday:'Domingo' };
    return map[eng] || eng;
  }

  async function createEventFromSlot(slot, attendeeEmail) {
    if (!accessToken) return alert('Conecta tu Google primero');
    const start = slot;
    const end = new Date(slot.getTime() + SLOT_MINUTES*60000);
    const attendees = attendeeEmail ? [{ email: attendeeEmail }] : [];

    const requestId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `req-${Date.now()}`;

    const payload = {
      summary: `Entrevista - ${newEvent.summary || 'Candidato'}`,
      description: newEvent.description || 'Entrevista vía Globty',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees,
      conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      reminders: { useDefault: true }
    };

    setStatusMsg('Creando evento...');
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Error create event', text);
      alert('Error creando evento: ' + res.statusText);
      setStatusMsg('Error');
      return;
    }
    const created = await res.json();
    const meetUrl = created.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri || created.hangoutLink || '';
    setStatusMsg('Evento creado');
    alert(`Evento creado ✅\nMeet: ${meetUrl}`);
    fetchEventsForDate(selectedDate);
  }

  function eventsForDay(d) { return events.filter(ev => { const start = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : null; return start ? isSameDay(start, d) : false; }); }

  function toggleCalendarSelection(idx) {
    const c = [...connectedCalendars];
    c[idx].selected = !c[idx].selected;
    setConnectedCalendars(c);
  }

  return (
    <div className="min-h-screen" style={{fontFamily:'Inter, Arial, sans-serif', padding:20, background:'#05060a'}}>
      <div style={{maxWidth:1100, margin:'0 auto', background:'#07080d', borderRadius:12, boxShadow:'0 8px 30px rgba(0,0,0,0.4)', overflow:'hidden'}}>
        <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:20, borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <div style={{width:40,height:40,background:'#7c3aed',borderRadius:8,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>G</div>
            <div>
              <div style={{fontWeight:700}}>Agenda Globty</div>
              <div style={{fontSize:12,color:'#94a3b8'}}>Interview Scheduler</div>
            </div>
          </div>
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <div style={{fontSize:13,color:'#cbd5e1'}}>{statusMsg || 'Desconectado'}</div>
            {!accessToken ? <button onClick={signIn} style={{background:'#7c3aed',color:'#fff',border:'none',padding:'8px 12px',borderRadius:8}}>Conectar Google</button> :
              <button onClick={signOut} style={{background:'#0b1220',border:'1px solid rgba(255,255,255,0.06)',padding:'8px 12px',borderRadius:8}}>Cerrar sesión</button>}
          </div>
        </header>

        <main style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:24, padding:24}}>
          <section>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
              <div style={{fontWeight:700}}>{format(monthStart,'MMMM yyyy')}</div>
              <div style={{display:'flex', gap:8}}>
                <button onClick={()=>setMonthStart(subMonths(monthStart,1))} style={{border:'1px solid rgba(255,255,255,0.04)',padding:'6px 10px',borderRadius:8}}>‹</button>
                <button onClick={()=>setMonthStart(addMonths(monthStart,1))} style={{border:'1px solid rgba(255,255,255,0.04)',padding:'6px 10px',borderRadius:8}}>›</button>
              </div>
            </div>

            <div style={{background:'#071421', padding:14, borderRadius:8}}>
              <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                {Array.from({length:14}).map((_,i) => {
                  const d = addDays(new Date(), i);
                  const isSel = isSameDay(d, selectedDate);
                  return (
                    <button key={d.toISOString()} onClick={()=>setSelectedDate(d)} style={{
                      padding:12, borderRadius:8, border:isSel?'2px solid rgba(124,58,237,0.9)':'1px solid rgba(255,255,255,0.03)', background:isSel?'rgba(124,58,237,0.06)':'transparent', minWidth:96, textAlign:'center'
                    }}>
                      <div style={{fontWeight:600}}>{format(d,'EEE dd')}</div>
                      <div style={{fontSize:12,color:'#94a3b8'}}>{format(d,'MMMM')}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{marginTop:18}}>
              <div style={{fontWeight:700, marginBottom:8}}>Horarios disponibles</div>

              <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                {freeSlots.length===0 ? <div style={{color:'#94a3b8'}}>No hay huecos libres para esta fecha.</div> :
                  freeSlots.map(s => (
                    <button key={s.toISOString()} onClick={() => { setNewEvent({...newEvent, start:s, end:new Date(s.getTime()+SLOT_MINUTES*60000)}); }} style={{padding:'8px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.04)', background:'transparent', color:'#e6eef8'}}>
                      {new Date(s).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                    </button>
                ))}
              </div>
            </div>
          </section>

          <aside>
            <div style={{marginBottom:12}}>
              <div style={{fontWeight:700, marginBottom:6}}>Calendarios conectados</div>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {connectedCalendars.map((c, i) => (
                  <label key={c.id} style={{display:'flex', gap:8, alignItems:'center'}}>
                    <input type="checkbox" checked={!!c.selected} onChange={() => toggleCalendarSelection(i)} />
                    <span style={{fontSize:13}}>{c.summary || c.id}</span>
                  </label>
                ))}
                {connectedCalendars.length===0 && <div style={{fontSize:13,color:'#94a3b8'}}>Conecta tu Google para ver tus calendarios.</div>}
              </div>
            </div>

            <div style={{marginBottom:12}}>
              <div style={{fontWeight:700, marginBottom:6}}>Crear entrevista</div>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                <input placeholder="Nombre candidato" value={newEvent.summary} onChange={e => setNewEvent({...newEvent, summary:e.target.value})} style={{padding:10,borderRadius:8,border:'1px solid rgba(255,255,255,0.04)',background:'transparent',color:'#e6eef8'}} />
                <input placeholder="Email candidato" value={newEvent.guests} onChange={e => setNewEvent({...newEvent, guests:e.target.value})} style={{padding:10,borderRadius:8,border:'1px solid rgba(255,255,255,0.04)',background:'transparent',color:'#e6eef8'}} />
                <input placeholder="Puesto (opcional)" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description:e.target.value})} style={{padding:10,borderRadius:8,border:'1px solid rgba(255,255,255,0.04)',background:'transparent',color:'#e6eef8'}} />
                <div style={{display:'flex', gap:8}}>
                  <DatePicker selected={newEvent.start} onChange={(d)=>{ const end = new Date(d.getTime()+SLOT_MINUTES*60000); setNewEvent({...newEvent,start:d,end}); setSelectedDate(d); }} showTimeSelect dateFormat="Pp" className="p-2 border rounded" />
                </div>
                <button onClick={() => createEventFromSlot(newEvent.start, (newEvent.guests || '').split(',')[0])} style={{background:'#7c3aed', color:'#fff', padding:'10px 12px', border:'none', borderRadius:8}}>Crear evento + Meet</button>
              </div>
            </div>

            <div>
              <div style={{fontWeight:700, marginBottom:6}}>Eventos del día</div>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {eventsForDay(selectedDate).length===0 ? <div style={{color:'#94a3b8'}}>No hay eventos</div> :
                  eventsForDay(selectedDate).map(ev => (
                    <div key={ev.id} style={{padding:8,border:'1px solid rgba(255,255,255,0.03)',borderRadius:8}}>
                      <div style={{fontWeight:600}}>{ev.summary}</div>
                      <div style={{fontSize:12,color:'#94a3b8'}}>{ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleString() : ev.start?.date}</div>
                      <div style={{fontSize:12,color:'#7c3aed'}}>{ev.conferenceData?.entryPoints?.[0]?.uri || ev.hangoutLink || ''}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          </aside>
        </main>

        <footer style={{padding:14, borderTop:'1px solid rgba(255,255,255,0.03)', fontSize:12, color:'#94a3b8'}}>Agenda Globty · Interview Scheduler</footer>
      </div>
    </div>
  );
}
