import React, { useEffect, useMemo, useRef, useState } from "react";

// --- Firebase config (tuya) ---
const firebaseConfig = {
  apiKey: "AIzaSyD_mA_6Z5gX0bMITNaEjLC5awY4Z7YC8dM",
  authDomain: "losquinques-cddf9.firebaseapp.com",
  projectId: "losquinques-cddf9",
  storageBucket: "losquinques-cddf9.appspot.com",
  messagingSenderId: "840666510554",
  appId: "1:840666510554:web:73fe3cec850588272f61e3",
  measurementId: "G-3CR7C76BN2",
};

const STAFF_PIN = "3030";
const LOCALE = "es-MX";
const TIMEZONE = "America/Monterrey";

// --- Firebase SDK ---
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
  limit,
} from "firebase/firestore";

// --- Pequeños componentes UI (sin libs externas) ---
function Card({ className = "", children }) {
  return (
    <div className={`bg-white rounded-lg shadow border border-gray-200 ${className}`}>
      {children}
    </div>
  );
}
function CardContent({ className = "", children }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
function Button({ className = "", children, ...props }) {
  return (
    <button
      className={
        "px-3 py-2 rounded text-white bg-black hover:opacity-90 disabled:opacity-60 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}
function Input(props) {
  return (
    <input
      {...props}
      className={
        "w-full border rounded px-3 py-2 outline-none focus:ring focus:ring-gray-300 " +
        (props.className || "")
      }
    />
  );
}
function Label({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700">
      {children}
    </label>
  );
}
function Checkbox({ checked, onChange, id }) {
  return (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange?.(e.target.checked)}
      className="h-4 w-4"
    />
  );
}

// --- Helpers ---
function initFirebase() {
  if (!getApps().length) initializeApp(firebaseConfig);
  return getFirestore();
}
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

export default function WaitlistApp() {
  const db = useMemo(() => initFirebase(), []);
  const [isStaffMode] = useState(
    () => new URLSearchParams(window.location.search).get("staff") === "1"
  );
  const [pinOk, setPinOk] = useState(!isStaffMode);
  const [pinInput, setPinInput] = useState("");

  // Cliente (form)
  const [name, setName] = useState("");
  const [people, setPeople] = useState(2);
  const [wantsSms, setWantsSms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);

  // Staff
  const [loadingList, setLoadingList] = useState(true);
  const [queue, setQueue] = useState([]);
  const unsubRef = useRef(null);

  // Suscripción Firestore para STAFF (sin where; filtramos en cliente)
  useEffect(() => {
    if (isStaffMode && pinOk) {
      const q = query(
        collection(db, "waitlist"),
        orderBy("createdAt", "asc"),
        limit(200)
      );
      const unsub = onSnapshot(q, (snap) => {
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        setQueue(rows.filter((r) => r.status === "waiting"));
        setLoadingList(false);
      });
      unsubRef.current = unsub;
      return () => unsub && unsub();
    }
  }, [db, isStaffMode, pinOk]);

  // Enviar check-in
  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || people < 1) return;
    setSubmitting(true);
    try {
      const ref = await addDoc(collection(db, "waitlist"), {
        name: name.trim(),
        people: Number(people),
        wantsSms: Boolean(wantsSms),
        status: "waiting",
        createdAt: serverTimestamp(),
      });
      setSubmittedTicket({ id: ref.id, name: name.trim(), people: Number(people) });
      setName("");
      setPeople(2);
      setWantsSms(false);
    } catch (err) {
      alert("Hubo un problema. Intenta de nuevo.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  // Acciones staff
  async function seatGuest(id) {
    try {
      await updateDoc(doc(db, "waitlist", id), {
        status: "seated",
        seatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      alert("No se pudo marcar como sentado.");
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
  async function markCalled(id) {
    try {
      await updateDoc(doc(db, "waitlist", id), {
        status: "called",
        calledAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      alert("No se pudo marcar como llamado.");
    }
  }

  // Estimación simple
  const etaMinutes = useMemo(() => {
    if (!queue.length) return 0;
    const perParty = 5;
    return queue.reduce((acc, r) => acc + perParty + Math.max(0, r.people - 2), 0);
  }, [queue]);

  // --- Pantalla PIN (staff) ---
  if (isStaffMode && !pinOk) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="w-full max-w-sm">
          <CardContent>
            <h1 className="text-xl font-semibold mb-2">Acceso de Staff</h1>
            <p className="text-sm text-gray-600 mb-4">
              Ingresa el PIN para ver y gestionar la lista de espera.
            </p>
            <div className="space-y-2 mb-3">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (pinInput === STAFF_PIN) setPinOk(true);
                  }
                }}
              />
            </div>
            <Button className="w-full" onClick={() => setPinOk(pinInput === STAFF_PIN)}>
              Entrar
            </Button>
            <p className="text-xs text-gray-500 mt-3">
              Tip: añade <code>?staff=1</code> a la URL en el iPad.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Vista STAFF ---
  if (isStaffMode && pinOk) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Lista de espera</h1>
          <div className="text-right">
            <p className="text-sm text-gray-600">En espera</p>
            <p className="text-2xl font-semibold">{queue.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loadingList ? (
            <Card>
              <CardContent>Cargando…</CardContent>
            </Card>
          ) : queue.length === 0 ? (
            <Card>
              <CardContent>No hay personas en espera por ahora.</CardContent>
            </Card>
          ) : (
            queue.map((r, idx) => (
              <Card key={r.id}>
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold truncate">{r.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200">
                          {r.people} {r.people === 1 ? "persona" : "personas"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatTime(r.createdAt)} • #{idx + 1}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Button onClick={() => markCalled(r.id)} className="bg-gray-700">
                        Llamar
                      </Button>
                      <Button onClick={() => seatGuest(r.id)} className="bg-green-600">
                        Pasar a mesa
                      </Button>
                      <Button onClick={() => removeGuest(r.id)} className="bg-red-600">
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="mt-8 flex items-center justify-between text-sm text-gray-600">
          <div>Espera aprox.: ~{etaMinutes} min (estimado)</div>
          <div>Zona horaria: {TIMEZONE}</div>
        </div>
      </div>
    );
  }

  // --- Vista CLIENTE ---
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent>
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Lista de espera</h1>
          </div>
          {submittedTicket ? (
            <div className="space-y-3">
              <p className="text-gray-800">
                ¡Listo, {submittedTicket.name}! Quedaste en la lista.
              </p>
              <div className="text-sm text-gray-600">
                Grupo: {submittedTicket.people}{" "}
                {submittedTicket.people === 1 ? "persona" : "personas"}
              </div>
              <Button onClick={() => setSubmittedTicket(null)} className="bg-gray-700">
                Apuntar a otra persona
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Marifer"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="people">Número de personas</Label>
                <Input
                  id="people"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  value={people}
                  onChange={(e) => setPeople(parseInt(e.target.value || "0", 10))}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="sms"
                  checked={wantsSms}
                  onChange={(v) => setWantsSms(Boolean(v))}
                />
                <Label htmlFor="sms" className="text-sm text-gray-600">
                  Quiero recibir notificación cuando mi mesa esté lista (próximamente)
                </Label>
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Enviando…" : "Anotarme"}
              </Button>
              <p className="text-xs text-gray-500">
                Tus datos se usan solo para gestionar el turno. Gracias por tu paciencia ✨
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
