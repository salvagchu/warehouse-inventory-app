# Warehouse Inventory App

Internal inventory management system built for Stark Tech's warehouse operations. Tracks parts across job sites, records every inbound/outbound movement, and keeps a full audit trail of who touched what and when.

**[English](#english)** | **[Español](#español)**

---

## English

### What this is

This started as a shared Excel sheet used to track parts across job sites — quantities required, ordered, received, and issued, one row per part with columns getting added every time material went out. It worked, until it didn't: no way to see history, no real permissions, and everyone editing the same file was a recipe for overwritten data.

This app replaces that workflow with a proper database-backed system, packaged as a Windows desktop app so it feels like just another program on the warehouse computer, not a browser tab someone forgets to save.

### How it works

- **Projects** are job sites (what used to be a tab in the spreadsheet). Each part belongs to one project.
- **Parts** carry the same fields as the original sheet: PO, vendor, part number, location, quantity required.
- **Movements** replace the old "add another column" pattern. Every inbound or outbound quantity is its own row in a movements table, so there's no limit and nothing gets overwritten. Quantity ordered, in, out, and available are all calculated from that history, not stored directly.
- **Orders** let you pick several parts and quantities at once, generate a printable Excel pick slip, and deduct everything from inventory in one action.
- **Roles**: Administrator (full access), Operator (can log movements and create orders), Viewer (read-only). Non-admins only see the projects they've been given access to.
- **Activity log**: every create, update, movement, and order is recorded automatically via database triggers — not something the app can forget to log, since it happens at the database level regardless of which client touches the data.
- **Real-time sync**: changes made by one person (or directly in the database) show up for everyone else within a couple seconds, no refresh needed.

### Stack

- **Frontend**: React + Vite, packaged with Electron for the Windows desktop shell
- **Backend**: Supabase (Postgres + Auth + Realtime), all business logic enforced through Row Level Security policies and triggers, not just app-side checks
- **Excel import/export**: `xlsx` for reading spreadsheets on import, `exceljs` for generating formatted order pick slips
- **Updates**: `electron-updater`, checking GitHub Releases on launch

### Getting started

```bash
git clone https://github.com/salvagchu/warehouse-inventory-app.git
cd warehouse-inventory-app
npm install
cp .env.example .env   # fill in your Supabase project URL and publishable key
npm run electron:dev
```

### Database setup

Run `supabase/schema.sql` in the Supabase SQL Editor on a fresh project. It creates all tables, views, RLS policies, and triggers in one pass. The `supabase/migration_*.sql` files are incremental changes applied on top of an already-running database — only needed if you're updating an existing install rather than starting fresh.

### Building the installer

```bash
npm run electron:build   # local .exe only, in /release
npm run release           # builds and publishes to GitHub Releases (needs GH_TOKEN set)
```

Bump the `version` field in `package.json` before publishing a new release — that's what installed apps compare against to know an update exists.

---

## Español

### Qué es esto

Esto empezó como una hoja de Excel compartida para llevar el control de partes por obra: cantidades requeridas, ordenadas, recibidas y entregadas, una fila por parte, agregando columnas nuevas cada vez que salía material. Funcionaba, hasta que dejó de funcionar: no había forma de ver el historial, no había permisos reales, y que varias personas editaran el mismo archivo terminaba en datos sobrescritos.

Esta app reemplaza ese flujo con un sistema real basado en base de datos, empaquetado como una app de escritorio para Windows, para que se sienta como cualquier otro programa en la computadora del almacén, no como una pestaña del navegador que alguien se olvida de guardar.

### Cómo funciona

- **Proyectos** son las obras (lo que antes era una pestaña en la hoja de cálculo). Cada parte pertenece a un proyecto.
- **Partes** tienen los mismos campos que la hoja original: PO, vendor, número de parte, ubicación, cantidad requerida.
- **Movimientos** reemplazan el patrón de "agregar otra columna". Cada entrada o salida de cantidad es su propia fila en una tabla de movimientos, así que no hay límite y nada se sobrescribe. Las cantidades ordenadas, entradas, salidas y disponibles se calculan a partir de ese historial, no se guardan directamente.
- **Pedidos** permiten elegir varias partes y cantidades a la vez, generar un Excel imprimible tipo "pick slip", y descontar todo del inventario en una sola acción.
- **Roles**: Administrador (acceso total), Operador (puede registrar movimientos y crear pedidos), Visor (solo lectura). Los que no son admin solo ven los proyectos a los que se les dio acceso.
- **Historial de actividad**: cada creación, edición, movimiento y pedido queda registrado automáticamente mediante triggers de base de datos — no es algo que la app pueda "olvidar" registrar, porque pasa a nivel de base de datos sin importar desde dónde se toque el dato.
- **Sincronización en tiempo real**: los cambios que hace una persona (o que se hacen directo en la base de datos) aparecen para todos los demás en un par de segundos, sin necesidad de refrescar.

### Stack técnico

- **Frontend**: React + Vite, empaquetado con Electron para el shell de escritorio de Windows
- **Backend**: Supabase (Postgres + Auth + Realtime), toda la lógica de negocio aplicada mediante políticas de Row Level Security y triggers, no solo validaciones del lado de la app
- **Importación/exportación de Excel**: `xlsx` para leer hojas de cálculo al importar, `exceljs` para generar los pick slips de pedidos con formato
- **Actualizaciones**: `electron-updater`, revisando GitHub Releases al abrir la app

### Cómo empezar

```bash
git clone https://github.com/salvagchu/warehouse-inventory-app.git
cd warehouse-inventory-app
npm install
cp .env.example .env   # completa con la URL y publishable key de tu proyecto de Supabase
npm run electron:dev
```

### Configuración de la base de datos

Corre `supabase/schema.sql` en el SQL Editor de Supabase sobre un proyecto nuevo. Crea todas las tablas, vistas, políticas RLS y triggers de una sola vez. Los archivos `supabase/migration_*.sql` son cambios incrementales que se aplican sobre una base de datos ya en uso — solo hacen falta si estás actualizando una instalación existente en vez de empezar desde cero.

### Generar el instalador

```bash
npm run electron:build   # solo genera el .exe local, en /release
npm run release           # compila y publica en GitHub Releases (necesita GH_TOKEN configurado)
```

Sube el campo `version` en `package.json` antes de publicar un release nuevo — es lo que las apps instaladas comparan para saber si existe una actualización.
