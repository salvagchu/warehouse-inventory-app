# Inventario de Almacén — App de Windows

App de escritorio (Electron) con base de datos en la nube (Supabase) para llevar el
inventario de partes por proyecto, con roles de usuario y permisos.

## Qué incluye

- Login / registro de usuarios
- Roles: **Administrador** (todo), **Operador** (registra entradas/salidas), **Visor** (solo consulta)
- Proyectos (equivalente a las pestañas de tu Excel), con filtro
- Tabla de partes con **Qty Required**, **Qty Ordered** (auto, suma de órdenes), **Qty IN**, **Qty OUT**
  y **Disponible**, todo calculado automáticamente desde el historial de movimientos
- Control de acceso: puedes decidir qué usuarios ven qué proyectos

---

## Paso 1 — Crear el backend en Supabase (gratis)

1. Ve a https://supabase.com y crea una cuenta / proyecto nuevo (elige una región cercana).
2. Dentro del proyecto, ve a **SQL Editor** → **New query**.
3. Copia y pega TODO el contenido del archivo `supabase/schema.sql` de esta carpeta, y dale **Run**.
   Esto crea las tablas, la vista de cálculo automático y las reglas de seguridad.
4. Ve a **Project Settings → API**. Copia:
   - **Project URL**
   - **anon public key**
5. En Authentication → Providers, confirma que "Email" esté habilitado (viene así por defecto).
   Opcional: en Authentication → Settings puedes desactivar "Confirm email" mientras pruebas,
   para no tener que confirmar cada cuenta por correo.

## Paso 2 — Crear tu primer usuario administrador

1. Corre la app (ver Paso 3) y regístrate normalmente desde la pantalla de login.
2. Todo usuario nuevo entra como "Visor" por defecto (sin acceso a proyectos).
3. Para hacerte administrador la primera vez, ve a Supabase → **Table Editor → profiles**,
   busca tu usuario y cambia la columna `role` a `admin` manualmente.
4. Desde ahí en adelante, ya puedes crear proyectos, partes, y administrar otros usuarios
   desde el botón "Usuarios" dentro de la app.

## Paso 3 — Instalar dependencias y probar en tu computadora

Necesitas tener [Node.js](https://nodejs.org) instalado (versión 18 o superior).

```bash
cd almacen-app
npm install
cp .env.example .env
```

Edita el archivo `.env` y pega tu URL y anon key de Supabase (Paso 1).

Para probar la app en modo desarrollo:

```bash
npm run electron:dev
```

Esto abre la app en una ventana de escritorio conectada a tu base de datos en la nube.

## Paso 4 — Generar el instalador de Windows (.exe)

```bash
npm run electron:build
```

Esto genera un instalador `.exe` dentro de la carpeta `dist_electron` (o `release`, según
la versión de electron-builder), listo para compartir e instalar en cualquier PC con Windows.
Cada persona que lo instale, con su usuario y contraseña, va a estar viendo y editando
**el mismo inventario en la nube** en tiempo real.

> Nota: generar el `.exe` funciona mejor corriendo el comando desde una PC con Windows.
> Si compilas desde Mac/Linux, `electron-builder` puede necesitar Wine instalado para
> empaquetar el instalador de Windows.

---

## Estructura del proyecto

```
almacen-app/
├── electron/          # Proceso principal de Electron (ventana de escritorio)
├── src/
│   ├── components/    # Login, Dashboard, tabla de partes, modales, usuarios
│   └── supabaseClient.js
├── supabase/
│   └── schema.sql     # Todo el backend: tablas, vista calculada, seguridad
└── package.json
```

## Cómo se resolvió lo del Excel

En tu hoja original, cada vez que sacaban material se agregaba un par de columnas nuevas
(Qty OUT / Date). Aquí eso se reemplaza por una tabla de **movimientos**: cada entrada o
salida es una fila nueva sin límite, y las columnas Qty IN, Qty OUT y Disponible se
calculan solas sumando ese historial — nunca se quedan sin espacio ni se pierde el rastro
de quién movió qué material y cuándo.

`Qty Ordered` se calcula sumando todas las órdenes de compra ligadas a esa parte
(por si una parte se pide en varios lotes). `Qty Required` se deja como un campo
editable porque viene del BOM del proyecto, no de un cálculo interno.

## Próximos pasos sugeridos (si los quieres, dímelo y los agregamos)

- Exportar el inventario filtrado a Excel/CSV
- Historial de movimientos por parte (ver quién sacó qué y cuándo, en detalle)
- Alertas cuando el disponible baja de cierto nivel
- Importar un Excel existente para cargar partes en lote
