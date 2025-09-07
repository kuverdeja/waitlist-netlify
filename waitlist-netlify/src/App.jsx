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
  apiKey: "AIzaSyD_mA_6Z5gX0bMITNaEjLC54wY4Z7YC8dM",
  authDomain: "losquinques-cddf9.firebaseapp.com",
  projectId: "losquinques-cddf9",
  storageBucket: "losquinques-cddf9.appspot.com",
  messagingSenderId: "840666510554",
  appId: "1:840666510554:web:73fe3ce850588272f61e3",
  measurementId: "G-3CR7C76BN2"
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

// Inicializar Firebase solo una vez
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// ⏱️ Configuración general
const START_MIN = 5;
const LOCALE = "es-MX";
const TIMEZONE = "America/Monterrey";

export default function App() {
  const [name, setName] = useState("");
  const [people, setPeople] = useState(1);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isStaff, setIsStaff] = useState(false);

  const listRef = collection(db, "waitlist");

  // 📡 Escuchar actualizaciones en tiempo real
  useEffect(() => {
    const q = query(listRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setQueue(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // ➕ Agregar cliente
  const addToWaitlist = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await addDoc(listRef, {
        name,
        people,
        status: "waiting",
        createdAt: serverTimestamp(),
      });
      setName("");
      setPeople(1);
    } catch (error) {
      console.error("Error al registrar:", error);
    }
    setLoading(false);
  };

  // ✅ Pasar cliente a mesa
  const serveClient = async (id) => {
    await updateDoc(doc(db, "waitlist", id), { status: "served" });
  };

  // ❌ Eliminar cliente
  const deleteClient = async (id) => {
    await deleteDoc(doc(db, "waitlist", id));
  };

  // ⏳ Calcular tiempo estimado
  const estimatedWait = useMemo(() => {
    return queue.filter((i) => i.status === "waiting").length * START_MIN;
  }, [queue]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center">Lista de espera</h1>

        {/* Formulario */}
        {!isStaff && (
          <Card>
            <CardContent className="space-y-4 pt-4">
              <form onSubmit={addToWaitlist} className="space-y-3">
                <div>
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <Label htmlFor="people">Número de personas</Label>
                  <Input
                    id="people"
                    type="number"
                    value={people}
                    onChange={(e) => setPeople(parseInt(e.target.value))}
                    min={1}
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? <Loader2 className="animate-spin mr-2" /> : "Apuntarse"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Lista */}
        <div className="space-y-3">
          {queue.map((item, index) => (
            <Card key={item.id} className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{index + 1}. En espera</p>
                  {/* 🔥 Aquí ya corregí para que salga con espacio */}
                  <p>
                    {item.name} — {item.people} personas
                  </p>
                  <p className="text-sm text-gray-500">
                    {item.createdAt?.toDate
                      ? item.createdAt.toDate().toLocaleTimeString(LOCALE, { timeZone: TIMEZONE })
                      : "Hora desconocida"}{" "}
                    • #{index + 1}
                  </p>
                </div>

                {isStaff && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => serveClient(item.id)}>
                      Pasar a mesa
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteClient(item.id)}>
                      Eliminar
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Tiempo estimado */}
        <p className="text-center text-gray-600">
          Espera aprox.: ~{estimatedWait} min (estimado)
          <br />
          Zona horaria: {TIMEZONE}
        </p>

        {/* Modo Staff */}
        <div className="flex items-center gap-2 justify-center">
          <Checkbox
            id="staff"
            checked={isStaff}
            onCheckedChange={setIsStaff}
          />
          <Label htmlFor="staff">Modo Staff</Label>
        </div>
      </div>
    </div>
  );
}
