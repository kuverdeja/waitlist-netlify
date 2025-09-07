
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import {
  getFirestore, collection, addDoc, serverTimestamp, onSnapshot,
  doc, updateDoc, deleteDoc, query, where, orderBy
} from 'firebase/firestore'
import { Clock, Users, CheckCircle2, Trash2, QrCode } from 'lucide-react'

/**
 * Cómo usar
 * 1) Crea proyecto en Firebase y activa Firestore.
 * 2) Reemplaza firebaseConfig con tus datos (del panel de Firebase).
 * 3) En Netlify: npm run build y sube la carpeta /dist (drag & drop).
 * 4) Clientes -> URL normal. Staff -> URL + ?staff=1 (pide PIN).
 */

// ⚠️ Reemplaza con tu propia config (la que ya compartiste en canvas)
const firebaseConfig = {
  apiKey: "AIzaSyD_mA_6Z5gX0bMITNaEjLC5awY4Z7YC8dM",
  authDomain: "losquinques-cddf9.firebaseapp.com",
  projectId: "losquinques-cddf9",
  storageBucket: "losquinques-cddf9.firebasestorage.app",
  messagingSenderId: "840666510554",
  appId: "1:840666510554:web:73fe3cec850588272f61e3",
  measurementId: "G-3CR7C76BN2"
}

const STAFF_PIN = "3030"
const LOCALE = "es-MX"
const TIMEZONE = "America/Monterrey"

function initFirebase() {
  if (!getApps().length) initializeApp(firebaseConfig)
  return getFirestore()
}

function formatTime(ts) {
  if (!ts) return ""
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return new Intl.DateTimeFormat(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TIMEZONE
    }).format(d)
  } catch { return "" }
}

export default function App() {
  const db = useMemo(() => initFirebase(), [])
  const [isStaffMode] = useState(() => new URLSearchParams(window.location.search).get('staff') === '1')
  const [pinOk, setPinOk] = useState(!isStaffMode)
  const [pinInput, setPinInput] = useState("")

  // cliente form
  const [name, setName] = useState("")
  const [people, setPeople] = useState(2)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)

  // staff list
  const [loadingList, setLoadingList] = useState(true)
  const [queue, setQueue] = useState([])

  useEffect(() => {
    if (isStaffMode && pinOk) {
      const q = query(
        collection(db, 'waitlist'),
        where('status', '==', 'waiting'),
        orderBy('createdAt', 'asc')
      )
      const unsub = onSnapshot(q, (snap) => {
        const rows = []
        snap.forEach(d => rows.push({ id: d.id, ...d.data() }))
        setQueue(rows)
        setLoadingList(false)
      })
      return () => unsub && unsub()
    }
  }, [db, isStaffMode, pinOk])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || Number(people) < 1) return
    setSubmitting(true)
    try {
      const ref = await addDoc(collection(db, 'waitlist'), {
        name: name.trim(),
        people: Number(people),
        status: 'waiting',
        createdAt: serverTimestamp()
      })
      setSubmitted({ id: ref.id, name: name.trim(), people: Number(people) })
      setName("")
      setPeople(2)
    } catch (e) {
      alert("Hubo un problema. Intenta de nuevo.")
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  async function seatGuest(id) {
    try { await updateDoc(doc(db, 'waitlist', id), { status: 'seated', seatedAt: serverTimestamp() }) }
    catch { alert('No se pudo marcar como sentado.') }
  }
  async function removeGuest(id) {
    try { await deleteDoc(doc(db, 'waitlist', id)) }
    catch { alert('No se pudo eliminar.') }
  }
  async function markCalled(id) {
    try { await updateDoc(doc(db, 'waitlist', id), { status: 'called', calledAt: serverTimestamp() }) }
    catch { alert('No se pudo marcar como llamado.') }
  }

  const etaMinutes = queue.length ? queue.reduce((acc, r) => acc + 5 + Math.max(0, (r.people||2)-2), 0) : 0

  if (isStaffMode && !pinOk) {
    return (
      <div className="wrap">
        <div className="card" style={{maxWidth:420}}>
          <div className="title"><QrCode size={20}/> Acceso de Staff</div>
          <p className="muted">Ingresa el PIN para ver y gestionar la lista de espera.</p>
          <div className="grid">
            <label htmlFor="pin">PIN</label>
            <input id="pin" type="password" inputMode="numeric" placeholder="••••"
              value={pinInput} onChange={e=>setPinInput(e.target.value)}
              onKeyDown={(e)=>{ if(e.key==='Enter' && pinInput===STAFF_PIN) setPinOk(true) }}
            />
            <button onClick={()=> setPinOk(pinInput===STAFF_PIN)}>Entrar</button>
            <p className="muted">Tip: añade <code>?staff=1</code> a la URL en el iPad.</p>
          </div>
        </div>
      </div>
    )
  }

  if (isStaffMode && pinOk) {
    return (
      <div className="wrap">
        <div className="card">
          <div className="row" style={{justifyContent:'space-between', marginBottom:12}}>
            <div className="title"><Users size={24}/> Lista de espera</div>
            <div style={{textAlign:'right'}}>
              <div className="muted">En espera</div>
              <div style={{fontSize:22, fontWeight:800}}>{queue.length}</div>
            </div>
          </div>

          {loadingList ? (
            <div className="muted">Cargando…</div>
          ) : queue.length === 0 ? (
            <div className="muted">No hay personas en espera por ahora.</div>
          ) : (
            <div className="list">
              {queue.map((r, idx) => (
                <div className="item" key={r.id}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <div>
                      <div style={{fontWeight:700, fontSize:18}}>{r.name}</div>
                      <div className="row muted">
                        <span className="pill">{r.people} {r.people===1? 'persona':'personas'}</span>
                        <span className="row" style={{gap:6}}><Clock size={16}/> {formatTime(r.createdAt)} • #{idx+1}</span>
                      </div>
                    </div>
                    <div className="actions">
                      <button className="secondary" onClick={()=>markCalled(r.id)}>Llamar</button>
                      <button onClick={()=>seatGuest(r.id)}><CheckCircle2 size={16}/> Pasar a mesa</button>
                      <button className="danger" onClick={()=>removeGuest(r.id)}><Trash2 size={16}/> Eliminar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="footer">
            <div className="row"><Clock size={16}/> Espera aprox.: ~{etaMinutes} min (estimado)</div>
            <div>Zona horaria: {TIMEZONE}</div>
          </div>
        </div>
      </div>
    )
  }

  // cliente
  return (
    <div className="wrap">
      <div className="card">
        <div className="title"><Users size={20}/> Lista de espera</div>
        {submitted ? (
          <div className="grid">
            <div>¡Listo, <b>{submitted.name}</b>! Quedaste en la lista.</div>
            <div className="muted">Grupo: {submitted.people} {submitted.people===1? 'persona':'personas'}</div>
            <button className="secondary" onClick={()=>setSubmitted(null)}>Apuntar a otra persona</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid">
            <div>
              <label htmlFor="name">Nombre</label>
              <input id="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Marifer" required />
            </div>
            <div>
              <label htmlFor="people">Número de personas</label>
              <input id="people" type="number" min="1" max="20" value={people} onChange={e=>setPeople(parseInt(e.target.value||'0',10))} required />
            </div>
            <button type="submit" disabled={submitting}>{submitting ? 'Enviando…' : 'Anotarme'}</button>
            <div className="muted">Tus datos se usan solo para gestionar el turno. Gracias por tu paciencia ✨</div>
          </form>
        )}
      </div>
    </div>
  )
}
