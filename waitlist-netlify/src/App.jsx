import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Clock, Users, CheckCircle2, Trash2, QrCode } from "lucide-react";
import { motion } from "framer-motion";

/**
 * 👉 Cómo usar (resumen)
 * - Vista cliente (check-in): https://TU-SITIO
 * - Vista staff (iPad):       https://TU-SITIO/?staff=1  (pide PIN)
 */

// 🔐 Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD_mA_6Z5gX0bMITNaEjLC5awY4Z7YC8dM",
  authDomain: "losquinques-cddf9.firebaseapp.com",
  projectId: "losquinques-cddf9",
  storageBucket: "losquinques-cddf9.appspot.com",
  messagingSenderId: "840666510554",
  appId: "1:840666510554:web:73fe3cec850588272f61e3",
  measurementId: "G-3CR7C76BN2",
};

// 🔑 PIN del staff
const STAFF_PIN = "3030";

// 🕒 Formato de hora
const LOCALE = "es-MX";
const TIMEZONE = "America/Monterrey";

// Firebase
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
  limit, // 👈 usamos limit y QUITAMOS where
} from "firebase/firestore";

function initFirebase() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
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
  const [isStaffMode] = useState(() => new URLSearchParams(window.location.search).get("staff") === "1");
  const [pinOk, setPinOk] = useState(!isStaffMode);
  const [pinInput, setPinInput] = useState("");

  // Form (cliente)
  const [name, setName] = useState("");
  const [people, setPeople] = useState(2);
  const [wantsSms, setWantsSms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);

  // Staff state
  const [loadingList, setLoadingList] = useState(true);
  const [queue, setQueue] = useState([]);
  const unsubRef = useRef(null);

  // 📡 Suscripción a la lista para STAFF (sin where; filtramos en cliente)
  useEffect(() => {
    if (isStaffMode && pinOk) {
      const q = query(
        collection(db, "waitlist"),
        orderBy("createdAt", "asc"),
        limit(200) // suficiente para un turno
      );
      const unsub = onSnapshot(q, (snap) => {
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        const onlyWaiting = rows.filter((r) => r.status === "waiting");
        setQueue(onlyWaiting);
        setLoadingList(false);
      });
      unsubRef.current = unsub;
      return () => unsub && unsub();
    }
  }, [db, isStaffMode, pinOk]);

  // ✍️ Envío de check-in (cliente)
  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (people < 1) return;
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
      await updateDoc(doc(db, "waitlist", id), { status: "seated", seatedAt: serverTimestamp() });
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
      await updateDoc(doc(db, "waitlist", id), { status: "called", calledAt: serverTimestamp() });
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

  // 🔐 Pantalla de PIN para staff
  if (isStaffMode && !pinOk) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
        <Card className="w-full max-w-sm shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              <h1 className="text-xl font-semibold">Acceso de Staff</h1>
            </div>
            <p className="text-sm text-neutral-600">Ingresa el PIN para ver y gestionar la lista de espera.</p>
            <div className="space-y-2">
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
            <p className="text-xs text-neutral-500">
              Tip: añade <span className="font-mono">?staff=1</span> a la URL en el iPad.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 👩‍🍳 Vista STAFF
  if (isStaffMode && pinOk) {
    return (
      <div className="min-h-screen bg-neutral-50 p-4 md:p-8">
        <header className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Users className="w-7 h-7" />
            </motion.div>
            <h1 className="text-2xl md:text-3xl font-bold">Lista de espera</h1>
          </div>
          <div className="text-right">
            <p className="text-sm text-neutral-600">En espera</p>
            <p className="text-2xl font-semibold">{queue.length}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4">
          {loadingList ? (
            <div className="flex items-center gap-2 text-neutral-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando…
            </div>
          ) : queue.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-6 text-neutral-600">No hay personas en espera por ahora.</CardContent>
            </Card>
          ) : (
            queue.map((r, idx) => (
              <Card key={r.id} className="shadow-sm">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-semibold truncate">{r.name}</span>
                        <span className="text-sm px-2 py-0.5 rounded-full bg-neutral-200">
                          {r.people} {r.people === 1 ? "persona" : "personas"}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1 flex items-center gap-1">
                        <Clock className="w-4 h-4" /> {formatTime(r.createdAt)} • #{idx + 1}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Button variant="secondary" onClick={() => markCalled(r.id)}>
                        Llamar
                      </Button>
                      <Button onClick={() => seatGuest(r.id)} className="gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Pasar a mesa
                      </Button>
                      <Button variant="destructive" onClick={() => removeGuest(r.id)} className="gap-2">
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <footer className="mt-8 flex items-center justify-between text-sm text-neutral-600">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> Espera aprox.: ~{etaMinutes} min (estimado)
          </div>
          <div>Zona horaria: {TIMEZONE}</div>
        </footer>
      </div>
    );
  }

  // 👤 Vista CLIENTE
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-lg shadow-lg">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-6 h-6" />
            <h1 className="text-2xl font-bold">Lista de espera</h1>
          </div>
          {submittedTicket ? (
            <div className="space-y-3">
              <p className="text-neutral-700">
                ¡Listo, {submittedTicket.name}! Quedaste en la lista.
              </p>
              <div className="text-sm text-neutral-600">
                Grupo: {submittedTicket.people} {submittedTicket.people === 1 ? "persona" : "personas"}
              </div>
              <Button onClick={() => setSubmittedTicket(null)} variant="secondary">
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
              <div className="flex items-center space-x-2">
                <Checkbox id="sms" checked={wantsSms} onCheckedChange={(v) => setWantsSms(Boolean(v))} />
                <Label htmlFor="sms" className="text-sm text-neutral-600">
                  Quiero recibir notificación cuando mi mesa esté lista (próximamente)
                </Label>
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Enviando…
                  </span>
                ) : (
                  "Anotarme"
                )}
              </Button>
              <p className="text-xs text-neutral-500">
                Tus datos se usan solo para gestionar el turno. Gracias por tu paciencia ✨
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
