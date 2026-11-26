-- =============================================================================
-- ESQUEMA RELACIONAL Y BASE DE DATOS: ASESORÍAS LORENS
-- Sistema de Inspección, Cuantificación de Daños y Liquidación de Siniestros
-- Motor: PostgreSQL 14+ | Codificación: UTF-8
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Usuarios y Autenticación RBAC
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'supervisor', 'inspector', 'liquidador_viewer', 'cliente');
    ELSE
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cliente';
        EXCEPTION WHEN duplicate_object THEN null;
        END;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol user_role NOT NULL DEFAULT 'inspector',
    doble_perfil BOOLEAN NOT NULL DEFAULT FALSE,
    roles TEXT[] DEFAULT ARRAY['inspector'],
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_cliente_rol_exclusivo CHECK (
        (rol = 'cliente' AND doble_perfil = FALSE AND roles = ARRAY['cliente'])
        OR
        (rol != 'cliente' AND NOT ('cliente' = ANY(roles)))
    )
);

-- 2. Liquidadores y Catálogos Independientes
CREATE TABLE IF NOT EXISTS liquidador (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(200) NOT NULL UNIQUE,
    rut VARCHAR(20),
    email_contacto VARCHAR(150),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalogo_liquidador (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    liquidador_id UUID NOT NULL REFERENCES liquidador(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    vigente BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Catálogo de Unidades de Medida
CREATE TABLE IF NOT EXISTS unidad_medida (
    id VARCHAR(20) PRIMARY KEY, -- 'm²', 'ml', 'm³', 'un', 'gl', 'kg', 'L', 'día'
    etiqueta VARCHAR(50) NOT NULL,
    dimension VARCHAR(20) NOT NULL CHECK (dimension IN ('area', 'volume', 'length', 'count', 'direct')),
    escala NUMERIC(12, 4) NOT NULL DEFAULT 1.0,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 4. Catálogos Base de Materiales, Procesos y Gastos por Liquidador
CREATE TABLE IF NOT EXISTS material_liquidador (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    catalogo_id UUID NOT NULL REFERENCES catalogo_liquidador(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    categoria VARCHAR(150) NOT NULL,
    unidad VARCHAR(20) NOT NULL REFERENCES unidad_medida(id),
    especificacion TEXT,
    presentacion_cantidad NUMERIC(12, 4) NOT NULL DEFAULT 1.0,
    presentacion_unidad VARCHAR(20) NOT NULL,
    precio_presentacion NUMERIC(14, 2), -- Nulo = Pendiente
    incluye_iva BOOLEAN NOT NULL DEFAULT TRUE,
    tasa_iva NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
    proveedor VARCHAR(200),
    fuente_cotizacion TEXT,
    fecha_precio DATE,
    region VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_material_catalogo UNIQUE (catalogo_id, codigo)
);

CREATE TABLE IF NOT EXISTS proceso_liquidador (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    catalogo_id UUID NOT NULL REFERENCES catalogo_liquidador(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    categoria VARCHAR(150) NOT NULL,
    unidad VARCHAR(20) NOT NULL REFERENCES unidad_medida(id),
    precio_unitario NUMERIC(14, 2), -- Nulo = Pendiente
    incluye_iva BOOLEAN NOT NULL DEFAULT FALSE,
    tasa_iva NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
    fuente TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_proceso_catalogo UNIQUE (catalogo_id, codigo)
);

CREATE TABLE IF NOT EXISTS gasto_plantilla (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    catalogo_id UUID NOT NULL REFERENCES catalogo_liquidador(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    categoria VARCHAR(150) NOT NULL,
    descripcion TEXT NOT NULL,
    unidad VARCHAR(20) NOT NULL DEFAULT 'gl',
    precio_unitario NUMERIC(14, 2),
    incluye_iva BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_gasto_catalogo UNIQUE (catalogo_id, codigo)
);

-- 4.b Tabla de Estados de Expedientes
CREATE TABLE IF NOT EXISTS estado_expediente (
    id VARCHAR(30) PRIMARY KEY, -- 'activo', 'en_espera', 'procesado'
    nombre VARCHAR(60) NOT NULL,
    descripcion VARCHAR(255),
    color VARCHAR(30) DEFAULT '#0284c7',
    badge_clase VARCHAR(50) DEFAULT 'blue lighten-5 blue-text text-darken-3',
    orden INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Expedientes de Inspección (Casos)
CREATE TABLE IF NOT EXISTS expediente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL, -- ej. 'SIS-2026-084' o 'LOR-2026-0001'
    cliente_nombre VARCHAR(200) NOT NULL,
    cliente_rut VARCHAR(20) NOT NULL,
    cliente_telefono VARCHAR(50),
    cliente_email VARCHAR(150),
    direccion VARCHAR(255) NOT NULL,
    comuna VARCHAR(100) NOT NULL,
    ciudad VARCHAR(100),
    region VARCHAR(100),
    banco_beneficiario VARCHAR(150),
    aseguradora VARCHAR(150),
    liquidador_id UUID NOT NULL REFERENCES liquidador(id),
    estado VARCHAR(30) NOT NULL DEFAULT 'activo' REFERENCES estado_expediente(id),
    numero_poliza VARCHAR(100),
    numero_siniestro VARCHAR(100),
    tipo_evento VARCHAR(100) NOT NULL DEFAULT 'Sismo',
    tipo_inmueble VARCHAR(100) NOT NULL DEFAULT 'Casa',
    sistema_constructivo VARCHAR(100) DEFAULT 'Albañilería confinada',
    fecha_evento DATE,
    fecha_visita DATE NOT NULL DEFAULT CURRENT_DATE,
    inspector_id UUID REFERENCES usuario(id),
    inspector_nombre VARCHAR(150),
    inspector_cargo VARCHAR(150) DEFAULT 'Inspector de terreno',
    supervisor_nombre VARCHAR(150),
    revisado BOOLEAN NOT NULL DEFAULT FALSE,
    avance_porcentaje INT DEFAULT 0,
    observaciones_generales TEXT,
    observaciones_tecnicas TEXT,
    observaciones_seguridad TEXT,
    conclusion TEXT,
    porcentaje_gg NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    porcentaje_utilidad NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    tasa_iva NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5.b Sectores del Inmueble Inspeccionados
CREATE TABLE IF NOT EXISTS sector_expediente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'activo',
    usuario_id UUID REFERENCES usuario(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_expediente_sector UNIQUE (expediente_id, nombre)
);

-- 6. Partidas de Daño y Levantamiento Geométrico
CREATE TABLE IF NOT EXISTS partida_dano (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
    sector_id UUID REFERENCES sector_expediente(id) ON DELETE SET NULL,
    sector VARCHAR(100) NOT NULL, -- ej. 'Baño 1', 'Living Comedor'
    elemento VARCHAR(100) NOT NULL, -- ej. 'Muro', 'Cielo'
    dano_tipo VARCHAR(100) NOT NULL, -- ej. 'Fisura', 'Humedad'
    materialidad VARCHAR(150),
    material_existente TEXT,
    descripcion_dano TEXT NOT NULL,
    reparacion_propuesta VARCHAR(255) NOT NULL,
    proceso_id UUID REFERENCES proceso_liquidador(id),
    es_estructural BOOLEAN NOT NULL DEFAULT FALSE,
    referencia_estructural TEXT,
    unidad_id VARCHAR(20) NOT NULL REFERENCES unidad_medida(id),
    metodo_calculo VARCHAR(20) NOT NULL CHECK (metodo_calculo IN ('LH', 'LW', 'perimeter', 'LWH', 'L', 'direct')),
    largo NUMERIC(10, 3) NOT NULL DEFAULT 0,
    ancho NUMERIC(10, 3) NOT NULL DEFAULT 0,
    alto NUMERIC(10, 3) NOT NULL DEFAULT 0,
    cantidad_directa NUMERIC(12, 3) NOT NULL DEFAULT 0,
    descuento NUMERIC(12, 3) NOT NULL DEFAULT 0,
    porcentaje_afectado NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (porcentaje_afectado > 0 AND porcentaje_afectado <= 100),
    cantidad_afectada NUMERIC(12, 3),
    porcentaje_intervencion NUMERIC(5, 2) DEFAULT 100.00,
    cantidad_medida NUMERIC(12, 3) NOT NULL DEFAULT 0,
    cantidad_reparacion NUMERIC(12, 3), -- Cantidad si difiere de la medida
    justificacion_reparacion TEXT,
    modo_precio VARCHAR(20) NOT NULL DEFAULT 'complete' CHECK (modo_precio IN ('complete', 'apu')),
    precio_unitario_neto NUMERIC(14, 2),
    incluye_iva BOOLEAN NOT NULL DEFAULT FALSE,
    tasa_iva NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
    subtotal_neto NUMERIC(14, 2) NOT NULL DEFAULT 0,
    precio_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    fuente_precio TEXT,
    proveedor_precio VARCHAR(200),
    fecha_cotizacion DATE,
    region_cotizacion VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Recursos para Análisis de Precios Unitarios (APU)
CREATE TABLE IF NOT EXISTS recurso_apu (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partida_id UUID NOT NULL REFERENCES partida_dano(id) ON DELETE CASCADE,
    material_id UUID REFERENCES material_liquidador(id),
    nombre VARCHAR(255) NOT NULL,
    especificacion TEXT,
    unidad VARCHAR(20) NOT NULL,
    consumo_unitario NUMERIC(12, 4) NOT NULL,
    presentacion_cantidad NUMERIC(12, 4) NOT NULL DEFAULT 1.0,
    presentacion_unidad VARCHAR(20) NOT NULL,
    precio_presentacion_neto NUMERIC(14, 2) NOT NULL,
    capas_manos INTEGER NOT NULL DEFAULT 1,
    porcentaje_merma NUMERIC(5, 2) NOT NULL DEFAULT 0,
    costo_total_neto NUMERIC(14, 2) NOT NULL,
    verificado BOOLEAN NOT NULL DEFAULT FALSE
);

-- 8. Gastos Operativos Adicionales
CREATE TABLE IF NOT EXISTS gasto_caso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
    categoria VARCHAR(150) NOT NULL,
    descripcion TEXT NOT NULL,
    unidad VARCHAR(20) NOT NULL DEFAULT 'gl',
    cantidad NUMERIC(12, 3) NOT NULL DEFAULT 1.0,
    precio_unitario_neto NUMERIC(14, 2) NOT NULL,
    subtotal_neto NUMERIC(14, 2) NOT NULL,
    verificado BOOLEAN NOT NULL DEFAULT FALSE,
    fuente TEXT,
    fecha_cotizacion DATE
);

-- 9. Repositorio de Evidencias Fotográficas
CREATE TABLE IF NOT EXISTS fotografia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
    sector_id UUID REFERENCES sector_expediente(id) ON DELETE SET NULL,
    partida_id UUID REFERENCES partida_dano(id) ON DELETE SET NULL,
    dano_id UUID REFERENCES partida_dano(id) ON DELETE SET NULL,
    nombre_original VARCHAR(255),
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_almacenamiento VARCHAR(500) NOT NULL,
    ruta_thumbnail VARCHAR(500),
    sector VARCHAR(100),
    descripcion TEXT,
    mime_type VARCHAR(50) NOT NULL,
    tamano_bytes BIGINT NOT NULL,
    usuario_id UUID REFERENCES usuario(id),
    fecha_captura TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Control de Versiones Inmutables (Snapshots)
CREATE TABLE IF NOT EXISTS version_informe (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
    correlativo VARCHAR(50) NOT NULL, -- ej. 'SIS-2026-084-I-001'
    es_valorizado BOOLEAN NOT NULL DEFAULT TRUE,
    costo_directo NUMERIC(14, 2) NOT NULL,
    gastos_generales NUMERIC(14, 2) NOT NULL,
    utilidad NUMERIC(14, 2) NOT NULL,
    subtotal_neto NUMERIC(14, 2) NOT NULL,
    iva NUMERIC(14, 2) NOT NULL,
    total_presupuesto NUMERIC(14, 2) NOT NULL,
    snapshot_json JSONB NOT NULL,
    supervisor_aprobador VARCHAR(150),
    emitido_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Auditoría de Operaciones
CREATE TABLE IF NOT EXISTS auditoria_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID REFERENCES expediente(id) ON DELETE SET NULL,
    usuario_id UUID REFERENCES usuario(id),
    accion VARCHAR(100) NOT NULL,
    detalles JSONB,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_expediente_codigo ON expediente(codigo);
CREATE INDEX IF NOT EXISTS idx_expediente_liquidador ON expediente(liquidador_id);
CREATE INDEX IF NOT EXISTS idx_expediente_estado ON expediente(estado);
CREATE INDEX IF NOT EXISTS idx_partida_expediente ON partida_dano(expediente_id);
CREATE INDEX IF NOT EXISTS idx_partida_sector ON partida_dano(sector);
CREATE INDEX IF NOT EXISTS idx_fotografia_expediente ON fotografia(expediente_id);
CREATE INDEX IF NOT EXISTS idx_recurso_partida ON recurso_apu(partida_id);


-- 12. Historial de Eventos de Evidencias Fotográficas (Timeline)
CREATE TABLE IF NOT EXISTS evidencia_eventos (
    id BIGSERIAL PRIMARY KEY,
    fotografia_id UUID NOT NULL REFERENCES fotografia(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
    tipo_evento VARCHAR(60) NOT NULL,
    descripcion TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidencia_eventos_foto_fecha ON evidencia_eventos(fotografia_id, created_at ASC);

-- 13. Catálogo de Etapas del Expediente
CREATE TABLE IF NOT EXISTS etapa_expediente (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion_publica TEXT,
    orden INT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 14. Relación M:N Verificada entre Expediente y Cliente
CREATE TABLE IF NOT EXISTS expediente_cliente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    titular BOOLEAN NOT NULL DEFAULT TRUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_expediente_cliente UNIQUE (expediente_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_expediente_cliente_usuario ON expediente_cliente(usuario_id);
CREATE INDEX IF NOT EXISTS idx_expediente_cliente_expediente ON expediente_cliente(expediente_id);

-- 15. Historial y Auditoría de Etapas del Expediente (Timeline de Seguimiento)
CREATE TABLE IF NOT EXISTS expediente_etapa_historial (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
    etapa_id VARCHAR(50) NOT NULL REFERENCES etapa_expediente(id),
    estado_proceso VARCHAR(30) NOT NULL DEFAULT 'completada' CHECK (estado_proceso IN ('completada', 'en_curso', 'pendiente', 'observada')),
    fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    descripcion_interna TEXT,
    descripcion_publica TEXT NOT NULL,
    visible_cliente BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_etapa_historial_expediente ON expediente_etapa_historial(expediente_id, created_at ASC);
