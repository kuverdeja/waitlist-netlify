import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Clock, Users, CheckCircle2, Trash2, QrCode } from "lucide-react";
import { motion } from "framer-motion";

// 🔑 Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD_mA_6Z5gX0bMITNaEjLC5awY4Z7YC8dM",
  authDomain: "losquinques-cddf9.firebaseapp.com",
  projectId: "losquinques-cddf9",
  storageBucket: "losquinques-cddf9.appspot.com",
  messagingSenderId: "840666510554",
  appId: "1:840666510554:web:73fe3cec850588272f61e3",
  measurementId: "G-3CR7C76BN2"
};

const STAFF_PIN = "3030"; 
const LOCALE = "es-MX";
const TIMEZONE = "America/Monterrey";

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
  orderBy
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
  const [isStaffMode, setIsStaffMode] = useState(() => new URLSearchParams(window.location.search).get("staff") === "1");
  const [pinOk, setPinOk] = useState(!isStaffMode);
  const [pinInput, setPinInput] = useState("");

  const [name, setName] = useState("");
  const [people, setPeople] = useState(2);
  const [wantsSms, setWantsSms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);

  const [loadingList, setLoadingList] = useState(true);
  const [queue, setQueue] = useState([]);
  const unsubRef = useRef(null);

  // 🔥 Suscripción a Firestore
  useEffect(() => {
    if (isStaffMode && pinOk) {
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
      unsubRef.current = unsub;
      return () => unsub && unsub();
    }
  }, [db, isStaffMode, pinOk]);

  // Enviar check-in
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

  async function seatGuest(id) {
    await updateDoc(doc(db, "waitlist", id), { status: "seated", seatedAt: serverTimestamp() });
  }

  async function removeGuest(id) {
    await deleteDoc(doc(db, "waitlist", id));
  }

  async function markCalled(id) {
    await updateDoc(doc(db, "waitlist", id), { status: "called", calledAt: serverTimestamp() });
  }

  // 🔢 Estimación simple
  const etaMinutes = useMemo(() => {
    if (!queue.length) return 0;
    const perParty = 5;
    return queue.reduce((acc, r) => acc + perParty + Math.max(0, r.people - 2), 0);
  }, [queue]);

  // 🔐 Pantalla de PIN
  if (isStaffMode && !pinOk) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
        <Card className="w-full max-w-sm shadow-lg">
          <CardContent className="p-6 space-y-4">
            <h1 className="text-xl font-semibold">Acceso de Staff</h1>
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              placeholder="••••"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setPinOk(pinInput === STAFF_PIN)}
            />
            <Button className="w-full" onClick={() => setPinOk(pinInput === STAFF_PIN)}>
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 👨‍🍳 Vista STAFF
  if (isStaffMode && pinOk) {
    return (
      <div className="min-h-screen bg-neutral-50 p-4">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Lista de espera</h1>
          <p className="text-sm">En espera: {queue.length}</p>
        </header>

        {loadingList ? (
          <p>Cargando...</p>
        ) : queue.length === 0 ? (
          <p>No hay personas en espera.</p>
        ) : (
          queue.map((r, idx) => (
            <Card key={r.id} className="mb-2">
              <CardContent className="flex justify-between items-center p-4">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm">{r.people} personas • #{idx + 1}</p>
                  <p className="text-xs text-gray-500">{formatTime(r.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => markCalled(r.id)}>Llamar</Button>
                  <Button onClick={() => seatGuest(r.id)}>Pasar a mesa</Button>
                  <Button variant="destructive" onClick={() => removeGuest(r.id)}>Eliminar</Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        <footer className="mt-6 text-sm text-gray-600">
          Espera aprox.: {etaMinutes} min • Zona: {TIMEZONE}
        </footer>
      </div>
    );
  }

  // 👩 Cliente
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <Card className="w-full max-w-lg shadow-lg">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold mb-4">Lista de espera</h1>
          {submittedTicket ? (
            <div>
              <p>¡Listo, {submittedTicket.name}! Quedaste en la lista.</p>
              <p>Grupo: {submittedTicket.people} personas</p>
              <Button onClick={() => setSubmittedTicket(null)} variant="secondary">Apuntar a otra persona</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="people">Número de personas</Label>
                <Input id="people" type="number" min={1} max={20} value={people} onChange={(e) => setPeople(parseInt(e.target.value || "0", 10))} required />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="sms" checked={wantsSms} onCheckedChange={(v) => setWantsSms(Boolean(v))} />
                <Label htmlFor="sms">Quiero recibir notificación (próximamente)</Label>
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Enviando..." : "Anotarme"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
