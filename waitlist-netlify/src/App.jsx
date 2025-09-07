import React, { useEffect, useMemo, useRef, useState } from "react";

// ⚙️ Configuración Firebase (tus claves públicas)
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";

/** ========= Ajustes rápidos ========= */
const STAFF_PIN = "3030";                 // PIN del staff
const LOCALE = "es-MX";                   // Locale
const TIMEZONE = "America/Monterrey";     // Zona horaria

// 🔐 Pega tu config. Dejé la tuya tal cual para que funcione directo.
const firebaseConfig = {
  apiKey: "AIzaSyD_mA_6Z5gX0bMITNaEjLC5awY4Z7YC8dM",
  authDomain: "losquinques-cddf9.firebaseapp.com",
  projectId: "losquinques-cddf9",
  storageBucket: "losquinques-cddf9.appspot.com",
  messagingSenderId: "840666510554",
  appId: "1:840666510554:web:73fe3cec850588272f61e3",
  measurementId: "G-3CR7C76BN2",
};
/** ==================================== */

function initFirebase() {
  if (!getApps().length) initializeApp(firebaseConfig);
  return getFirestore();
}

function formatTime(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return new Intl.DateTimeFormat(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TIMEZONE,
    }).format(d);
  } catch {
    return "";
  }
}

export default function App() {
  const db = useMemo(() => initFirebase(), []);
  const [isStaffMode] = useState(
    () => new URLSearchParams(window.location.search).get("staff") === "1"
  );
  const [pinOk, setPinOk] = useState(!isStaffMode);
  const [pinInput, setPinInput] = useState("");

  // Cliente (form)
  const [name, setName] = useState("");
  const [people, setPeople] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);

  // Staff
  const [loadingList, setLoadingList] = useState(true);
  const [queue, setQueue] = useState([]);
  const unsubRef = useRef(null);

  /** Suscripción (STAFF) — SIN índice:
   *   - ordenamos por createdAt
   *   - y filtramos en cliente por status==="waiting"
   */
  useEffect(() => {
    if (isStaffMode && pinOk) {
      const q = query(collection(db, "waitlist"), orderBy("createdAt", "asc"));
      const unsub = onSnapshot(q, (snap) => {
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        const waiting = rows.filter((r) => r.status === "waiting");
        setQueue(waiting);
        setLoadingList(false);
      });
      unsubRef.current = unsub;
      return () => unsub && unsub();
    }
  }, [db, isStaffMode, pinOk]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || people < 1) return;
    setSubmitting(true);
    try {
      const ref = await addDoc(collection(db, "waitlist"), {
        name: name.trim(),
        people: Number(people),
        status: "waiting",
        createdAt: serverTimestamp(),
      });
      setSubmittedTicket({ id: ref.id, name: name.trim(), people: Number(people) });
      setName("");
      setPeople(2);
    } catch (err) {
      alert("Hubo un problema. Intenta de nuevo.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function seatGuest(id) {
    try {
      await updateDoc(doc(db, "waitlist", id), {
        status: "seated",
        seatedAt: serverTimestamp(),
      });
    } catch (e) {
      alert("No se pudo marcar como sentado.");
      console.error(e);
    }
  }

  async function removeGuest(id) {
    try {
      await deleteDoc(doc(db, "waitlist", id));
    } catch (e) {
      alert("No se pudo eliminar.");
      console.error(e);
    }
  }

  async function markCalled(id) {
    try {
      await updateDoc(doc(db, "waitlist", id), {
        status: "called",
        calledAt: serverTimestamp(),
      });
    } catch (e) {
      alert("No se pudo marcar como llamado.");
      console.error(e);
    }
  }

  const etaMinutes = useMemo(() => {
    if (!queue.length) return 0;
    const perParty = 6; // heurística simple
    return queue.reduce(
      (acc, r) => acc + perParty + Math.max(0, (r.people ?? 2) - 2),
      0
    );
  }, [queue]);

  /** ---------- Vistas ---------- */

  // Gate de PIN para staff
  if (isStaffMode && !pinOk) {
    return (
      <div className="wrap">
        <div className="card">
          <div className="pad">
            <h1>Acceso de Staff</h1>
            <p className="muted">Ingresa el PIN para gestionar la lista.</p>
            <label htmlFor="pin">PIN</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              placeholder="••••"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setPinOk(pinInput === STAFF_PIN);
              }}
            />
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => setPinOk(pinInput === STAFF_PIN)}>
                Entrar
              </button>
              <span className="pinTip">Tip: usa la URL con <b>?staff=1</b> en el iPad.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STAFF
  if (isStaffMode && pinOk) {
    return (
      <div className="wrap">
        <div className="card">
          <div className="pad">
            <div className="top">
              <h1>Lista de espera</h1>
              <div className="right">
                <div className="muted">En espera</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{queue.length}</div>
              </div>
            </div>

            {loadingList ? (
              <div className="muted">Cargando…</div>
            ) : queue.length === 0 ? (
              <div className="muted">No hay personas en espera por ahora.</div>
            ) : (
              <div className="list">
                {queue.map((r, idx) => (
                  <div className="tile" key={r.id}>
                    <div>
                      {/* 👇 nombre + separador + #personas (más legible) */}
                      <div className="title">
                        {r.name} — {r.people} {r.people === 1 ? "persona" : "personas"}
                      </div>
                      <div className="sub">
                        {formatTime(r.createdAt)} • #{idx + 1}
                      </div>
                    </div>
                    <div className="actions">
                      <button className="btn secondary" onClick={() => markCalled(r.id)}>
                        Llamar
                      </button>
                      <button className="btn" onClick={() => seatGuest(r.id)}>
                        Pasar a mesa
                      </button>
                      <button className="btn danger" onClick={() => removeGuest(r.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="sub" style={{ marginTop: 16 }}>
              ⏱️ Espera aprox.: ~{etaMinutes} min (estimado) · Zona horaria: {TIMEZONE}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CLIENTE (check-in)
  return (
    <div className="wrap">
      <div className="card">
        <div className="pad">
          <h1>Lista de espera</h1>
          {submittedTicket ? (
            <>
              <p>
                ¡Listo, <b>{submittedTicket.name}</b>! Quedaste en la lista.
              </p>
              <p className="muted">
                Grupo: {submittedTicket.people}{" "}
                {submittedTicket.people === 1 ? "persona" : "personas"}
              </p>
              <button className="btn secondary" onClick={() => setSubmittedTicket(null)}>
                Apuntar a otra persona
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <label htmlFor="name">Nombre</label>
              <input
                id="name"
                type="text"
                required
                placeholder="Ej. Marifer"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <label htmlFor="people">Número de personas</label>
              <input
                id="people"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                required
                value={people}
                onChange={(e) => setPeople(parseInt(e.target.value || "0", 10))}
              />

              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn" type="submit" disabled={submitting}>
                  {submitting ? "Enviando…" : "Anotarme"}
                </button>
              </div>

              <p className="muted" style={{ marginTop: 12 }}>
                Tus datos se usan solo para gestionar el turno. Gracias por tu paciencia ✨
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
