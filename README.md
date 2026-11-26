# ASESORÍAS LORENS - Sistema de Inspección, Cuantificación de Daños y Liquidación de Siniestros

Sistema Full Stack desacoplado con interfaz responsiva basada en **Materialize CSS** y backend en **Node.js / Express** con motor relacional **PostgreSQL 14+**.

---

## 🚀 Arquitectura y Módulos Implementados

1. **Módulo de Autenticación y RBAC**:
   - Roles: `admin`, `supervisor`, `inspector`, `liquidador_viewer`.
   - Firma y verificación de sesiones mediante JWT y hash bcrypt.
2. **Módulo de Perfiles de Liquidadores (Multi-Tarifario)**:
   - Aislamiento estricto de catálogos y tarifas (SEGURED / COOPER, JUAN PABLO VALDIVIESO, Charles Taylor, Mac Larens, Viollier, Marchard).
   - *Regla crítica de negocio*: Si se cambia de liquidador en un expediente, las tarifas se resetean a `PENDIENTE` para proteger la información comercial.
3. **Módulo de Expedientes y Siniestros**:
   - Gestión integral de casos con datos del cliente, aseguradora, póliza, fecha de evento y de visita.
   - Caso base precargado: **SIS-2026-084** (Sismo).
4. **Módulo de Levantamiento y Geometría en Vivo**:
   - Fórmulas de cálculo soportadas:
     - **LH**: Muro ($L \times H$)
     - **LW**: Piso/Cielo ($L \times W$)
     - **Perímetro $\times$ Altura**: $2 \times (L + W) \times H$
     - **LWH**: Volumen ($m^3$)
     - **L**: Longitud lineal ($ml$)
     - **Directa**: Cantidades puntuales ($un, gl, kg, L, \text{día}$)
   - Algoritmo de deducción y afectación:
     $$\text{Medida} = (\text{Bruto} - \text{Descuento}) \times \frac{\text{Afectado}\%}{100}$$
   - Cantidad de reparación justificada (paños completos o uniformidad).
5. **Cascada Presupuestaria Financiera**:
   - Costo Directo = $\sum \text{Partidas} + \sum \text{Gastos Adicionales}$
   - Gastos Generales (GG) = $\text{Directo} \times 25\%$
   - Subtotal Neto = $\text{Directo} + \text{GG} + \text{Utilidad}$
   - IVA (19%) = $\text{Subtotal Neto} \times 0.19$
   - Total Liquidación = $\text{Subtotal Neto} + \text{IVA}$
6. **Gastos Operativos Adicionales**: Fletes, escombros, aseo y entrega, protección de áreas no dañadas.
7. **Evidencias Fotográficas**: Fotos georreferenciadas con timestamp y descripción técnica.
8. **Snapshots Inmutables y Auditoría**: Congelamiento de presupuestos aprobados con correlativo oficial (ej. `SIS-2026-084-I-001`).

---

## 📁 Estructura del Proyecto

```
sistema-asesorias/
├── config/
│   ├── database.js          # Pool de conexiones pg (PostgreSQL)
│   └── auth.js              # Token JWT + bcrypt
├── controllers/
│   ├── authController.js    # Login y perfil
│   ├── caseController.js    # CRUD de expedientes y cálculo financiero
│   ├── lineController.js    # Partidas y fórmulas geométricas
│   ├── photoController.js   # Registro de fotografías
│   └── reportController.js  # Snapshots inmutables
├── middleware/
│   ├── authenticate.js      # Middleware de protección JWT
│   └── authorize.js         # Control RBAC por rol
├── models/
│   └── dbQueries.js         # Consultas SQL parametrizadas
├── public/                  # Frontend estático servido por Express
│   ├── css/
│   │   └── app-custom.css   # Estilos Materialize complementarios
│   ├── js/
│   │   ├── apiService.js    # Cliente Fetch asíncrono
│   │   ├── budgetViewer.js  # Renderizador de acta oficial y canvas
│   │   └── app.js           # Orquestación de eventos y calculadora
│   └── index.html           # SPA con Materialize CSS
├── scripts/
│   └── seedRunner.js        # Script de migración y población de datos
├── index.html               # SPA directa en raíz
├── schema.sql               # Esquema DDL para PostgreSQL
├── seeds.sql                # Semillas de prueba
├── server.js                # Servidor Express
├── package.json             # Dependencias del proyecto
└── .env.example             # Variables de entorno
```

---

## ⚡ Instalación y Puesta en Marcha Rápida

### Opción 1: Ejecución en 1 Clic (Recomendada en Windows)
Haz doble clic en **[`iniciar.bat`](file:///d:/sistema%20asesorias/iniciar.bat)** (o [`run.bat`](file:///d:/sistema%20asesorias/run.bat)).
El script automáticamente:
1. Comprueba la presencia de **Node.js**.
2. Genera el archivo `.env` de configuración si aún no existe.
3. Instala las dependencias de `npm` si es la primera vez.
4. Abre la aplicación en tu navegador web en `http://localhost:3000`.
5. Inicia el servidor Node.js / Express.

---

### Opción 2: Ejecución Manual por Consola

### 1. Requisitos Previos
- **Node.js** 16+ instalado.
- **PostgreSQL 14+** (opcional para ejecución con base de datos real; el sistema incluye modo de respaldo en memoria automático).

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Configuración de Variables de Entorno
Crea tu archivo `.env` a partir de `.env.example`:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=lorens_db
JWT_SECRET=lorens_super_secure_jwt_secret_key_2026!
```

### 4. Carga de Base de Datos (Opcional si usas PostgreSQL)
```bash
npm run seed
```

### 5. Iniciar el Servidor
```bash
npm start
```
Abre en tu navegador: **[http://localhost:3000](http://localhost:3000)**.
*(También puedes abrir directamente `index.html` en tu navegador con doble clic para el modo visor/interactivo).*

---

## 🔑 Credenciales de Prueba (RBAC)

- **Inspector**: `inspector@lorens.cl` / `Admin2026!`
- **Administrador**: `admin@lorens.cl` / `Admin2026!`

