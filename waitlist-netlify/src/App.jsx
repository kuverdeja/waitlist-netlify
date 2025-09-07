import React, { useEffect, useMemo, useRef, useState } from "react";

// 🔐 Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD_mA_6Z5gX0bMITNaEjLC54wY4Z7YC8dM",
  authDomain: "losquinques-cddf9.firebaseapp.com",
  projectId: "losquinques-cddf9",
  storageBucket: "losquinques-cddf9.appspot.com",
  messagingSenderId: "840666510554",
  appId: "1:840666510554:web:73fe3ce850588272f61e3",
  measurementId: "G-3CR7C76BN2",
};

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
  where,
  orderBy,
} from "firebase/firestore";

// ✅ Inicializa Firebase una sola vez
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// ⚙️ Config
const LOCALE = "es-MX";
const TIMEZONE = "America/Monterrey";
const STAFF_PIN = "3030";

function formatTime(ts) {
  if (!ts) return "";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
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
  // ¿Staff?
  const isStaffDefault = new URLSearchParams(window.location.search).get("staff") === "1";
  const [isStaff, setIsStaff] = useState(isStaffDefault);
  const [pinOk, setPinOk] = useState(!isStaffDefault);
  const [pin, setPin] = useState("");

  // Form cliente
  const [name, setName] = useState("");
  const [people, setPeople] = useState(2);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  // Lista
  const [loadingList, setLoadingList] = useState(true);
  const [queue, setQueue] = useState([]);

  // Suscripción (solo staff y con PIN OK)
  useEffect(() => {
    if (!isStaff || !pinOk) return;
    const q = query(
      collection(db, "waitlist"),
      where("status", "==", "waiting"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      setQueue(rows);
      setLoadingList(false);
    });
    return () => unsub && unsub();
  }, [isStaff, pinOk]);

  // Enviar check-in (cliente)
  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || people < 1) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "waitlist"), {
        name: name.trim(),
        people: Number(people),
        status: "waiting",
        createdAt: serverTimestamp(),
      });
      setSubmitted({ id: ref.id, name: name.trim(), people: Number(people) });
      setName("");
      setPeople(2);
    } catch (err) {
      alert("Hubo un problema. Intenta de nuevo.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  // Acciones staff
  async function markCalled(id) {
    try {
      await updateDoc(doc(db, "waitlist", id), { status: "called", calledAt: serverTimestamp() });
    } catch (e) {
      console.error(e);
      alert("No se pudo marcar como llamado.");
    }
  }
  async function seatGuest(id) {
    try {
      await updateDoc(doc(db, "waitlist", id), { status: "seated", seatedAt: serverTimestamp() });
    } catch (e) {
      console.error(e);
      alert("No se pudo pasar a mesa.");
    }
  }
  async function removeGuest(id) {
    try {
      await deleteDoc(doc(db, "waitlist", id));
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar.");
    }
  }

  // ETA super simple
  const etaMinutes = useMemo(() => {
    if (!queue.length) return 0;
    const perParty = 5;
    return queue.reduce((acc, r) => acc + perParty + Math.max(0, r.people - 2), 0);
  }, [queue]);

  // Vista PIN staff
  if (isStaff && !pinOk) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6 space-y-4">
          <h1 className="text-xl font-semibold">Acceso de Staff</h1>
          <p className="text-sm text-neutral-600">
            Ingresa el PIN para ver y gestionar la lista de espera.
          </p>
          <input
            type="password"
            inputMode="numeric"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setPinOk(pin === STAFF_PIN)}
          />
          <button
            className="w-full bg-black text-white rounded-lg py-2"
            onClick={() => setPinOk(pin === STAFF_PIN)}
          >
            Entrar
          </button>
          <p className="text-xs text-neutral-500">
            Tip: añade <span className="font-mono">?staff=1</span> a la URL en el iPad.
          </p>
        </div>
      </div>
    );
  }

  // Vista STAFF
  if (isStaff && pinOk) {
    return (
      <div className="min-h-screen bg-neutral-50 p-4 md:p-8">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Lista de espera</h1>
          <div className="text-right">
            <p className="text-sm text-neutral-600">En espera</p>
            <p className="text-2xl font-semibold">{queue.length}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4">
          {loadingList ? (
            <div className="text-neutral-600">Cargando…</div>
          ) : queue.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-6 text-neutral-600">
              No hay personas en espera por ahora.
            </div>
          ) : (
            queue.map((r, idx) => (
              <div key={r.id} className="bg-white rounded-xl shadow p-4 md:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-semibold truncate">{r.name}</span>
                      {/* 👇 Separador bonito entre nombre y personas */}
                      <span className="text-sm px-2 py-0.5 rounded-full bg-neutral-200">
                        {r.people} {r.people === 1 ? "persona" : "personas"}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 mt-1">
                      {formatTime(r.createdAt)} • #{idx + 1}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      className="px-3 py-2 rounded-lg bg-neutral-200 hover:bg-neutral-300"
                      onClick={() => markCalled(r.id)}
                    >
                      Llamar
                    </button>
                    <button
                      className="px-3 py-2 rounded-lg bg-black text-white"
                      onClick={() => seatGuest(r.id)}
                    >
                      Pasar a mesa
                    </button>
                    <button
                      className="px-3 py-2 rounded-lg bg-red-500 text-white"
                      onClick={() => removeGuest(r.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="mt-8 flex items-center justify-between text-sm text-neutral-600">
          <div>Espera aprox.: ~{etaMinutes} min (estimado)</div>
          <div>Zona horaria: {TIMEZONE}</div>
        </footer>
      </div>
    );
  }

  // Vista CLIENTE
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">Lista de espera</h1>
        </div>

        {submitted ? (
          <div className="space-y-3">
            <p className="text-neutral-700">
              ¡Listo, <b>{submitted.name}</b>! Quedaste en la lista.
            </p>
            <div className="text-sm text-neutral-600">
              Grupo: {submitted.people} {submitted.people === 1 ? "persona" : "personas"}
            </div>
            <button
              onClick={() => setSubmitted(null)}
              className="px-4 py-2 rounded-lg bg-neutral-200 hover:bg-neutral-300"
            >
              Apuntar a otra persona
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Nombre
              </label>
              <input
                id="name"
                className="w-full border rounded-lg px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Marifer"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="people" className="text-sm font-medium">
                Número de personas
              </label>
              <input
                id="people"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                className="w-full border rounded-lg px-3 py-2"
                value={people}
                onChange={(e) => setPeople(parseInt(e.target.value || "0", 10))}
                required
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2 rounded-lg bg-black text-white"
            >
              {saving ? "Enviando…" : "Anotarme"}
            </button>
            <p className="text-xs text-neutral-500">
              Tus datos se usan solo para gestionar el turno. Gracias por tu paciencia ✨
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
