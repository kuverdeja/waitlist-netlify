
# Waitlist App — Netlify

## Pasos rápidos
1. Instala dependencias
   ```bash
   npm install
   ```

2. Modo local
   ```bash
   npm run dev
   ```
   Abre el link que te aparece (http://localhost:5173).

3. Build para Netlify
   ```bash
   npm run build
   ```
   Sube la carpeta `dist/` a Netlify con Drag & Drop.

## Config Firebase
Edita en `src/App.jsx` el objeto `firebaseConfig` con tus datos. 
Clientes: URL normal.  
Staff: la misma URL con `?staff=1` y el PIN definido en `STAFF_PIN`.
