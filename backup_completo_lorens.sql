
-- =============================================================================
-- COMPATIBILIDAD UNIVERSAL CON SUPABASE / NEON / POSTGRESQL 13+
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Función de compatibilidad por si se invoca explícitamente public.uuid_generate_v4()
CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
RETURNS uuid AS $$
BEGIN
    RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;
-- =============================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'supervisor',
    'inspector',
    'liquidador_viewer',
    'cliente',
    'ajustador'
);


--
-- Name: asesorias_get_encryption_key(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.asesorias_get_encryption_key() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_key text;
BEGIN
    v_key := current_setting('asesorias.master_key', true);
    IF v_key IS NULL OR v_key = '' THEN
        -- Clave maestra por defecto para desarrollo local
        -- IMPORTANTE: En producción, configurar vía SET asesorias.master_key = '...'
        v_key := 'AsesoriasMaster_ClaveCifrado_AES256_Secreta_2026';
    END IF;
    RETURN v_key;
END;
$$;


--
-- Name: fn_blind_hash(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_blind_hash(p_value text, p_key text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_key text;
BEGIN
    IF p_value IS NULL THEN
        RETURN NULL;
    END IF;
    v_key := COALESCE(p_key, asesorias_get_encryption_key());
    RETURN encode(hmac(lower(trim(p_value)), v_key, 'sha256'), 'hex');
END;
$$;


--
-- Name: fn_decrypt_field(bytea, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_decrypt_field(p_cipher_bytea bytea, p_key text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_key text;
BEGIN
    IF p_cipher_bytea IS NULL THEN
        RETURN NULL;
    END IF;
    v_key := COALESCE(p_key, asesorias_get_encryption_key());
    BEGIN
        RETURN pgp_sym_decrypt(p_cipher_bytea, v_key);
    EXCEPTION WHEN OTHERS THEN
        RETURN '[ERROR_CLAVE_INVALIDA]';
    END;
END;
$$;


--
-- Name: fn_encrypt_field(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_encrypt_field(p_plain_text text, p_key text DEFAULT NULL::text) RETURNS bytea
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_key text;
BEGIN
    IF p_plain_text IS NULL THEN
        RETURN NULL;
    END IF;
    v_key := COALESCE(p_key, asesorias_get_encryption_key());
    RETURN pgp_sym_encrypt(p_plain_text, v_key, 'cipher-algo=aes256, compress-algo=1');
END;
$$;


--
-- Name: fn_update_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: fn_v_inquiries_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_v_inquiries_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO inquiries (
        id, reference, request_id, owner_id, damage_type, stage, insurance,
        region, commune, address_encrypted, financial_institution, case_type,
        mass_event_id, event_date, description_encrypted, name_encrypted,
        email_encrypted, email_hash, phone_encrypted, status,
        tracking_key_hash, tracking_version, progress_version, last_progress_id,
        privacy_version, consented_at, created_at, updated_at
    ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()::text),
        NEW.reference,
        NEW.request_id,
        NEW.owner_id,
        NEW.damage_type,
        NEW.stage,
        NEW.insurance,
        NEW.region,
        NEW.commune,
        fn_encrypt_field(NEW.address),
        NEW.financial_institution,
        NEW.case_type,
        NEW.mass_event_id,
        NEW.event_date,
        fn_encrypt_field(NEW.description),
        fn_encrypt_field(NEW.name),
        fn_encrypt_field(NEW.email),
        fn_blind_hash(NEW.email),
        fn_encrypt_field(NEW.phone),
        COALESCE(NEW.status, 'recibida'),
        NEW.tracking_key_hash,
        COALESCE(NEW.tracking_version, 0),
        COALESCE(NEW.progress_version, 0),
        NEW.last_progress_id,
        NEW.privacy_version,
        COALESCE(NEW.consented_at, CURRENT_TIMESTAMP),
        COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
        COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
    );
    RETURN NEW;
END;
$$;


--
-- Name: fn_v_inquiries_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_v_inquiries_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE inquiries SET
        owner_id = NEW.owner_id,
        damage_type = NEW.damage_type,
        stage = NEW.stage,
        insurance = NEW.insurance,
        region = NEW.region,
        commune = NEW.commune,
        address_encrypted = CASE 
            WHEN NEW.address IS DISTINCT FROM OLD.address THEN fn_encrypt_field(NEW.address)
            ELSE address_encrypted END,
        financial_institution = NEW.financial_institution,
        case_type = NEW.case_type,
        mass_event_id = NEW.mass_event_id,
        event_date = NEW.event_date,
        description_encrypted = CASE 
            WHEN NEW.description IS DISTINCT FROM OLD.description THEN fn_encrypt_field(NEW.description)
            ELSE description_encrypted END,
        name_encrypted = CASE 
            WHEN NEW.name IS DISTINCT FROM OLD.name THEN fn_encrypt_field(NEW.name)
            ELSE name_encrypted END,
        email_encrypted = CASE 
            WHEN NEW.email IS DISTINCT FROM OLD.email THEN fn_encrypt_field(NEW.email)
            ELSE email_encrypted END,
        email_hash = CASE 
            WHEN NEW.email IS DISTINCT FROM OLD.email THEN fn_blind_hash(NEW.email)
            ELSE email_hash END,
        phone_encrypted = CASE 
            WHEN NEW.phone IS DISTINCT FROM OLD.phone THEN fn_encrypt_field(NEW.phone)
            ELSE phone_encrypted END,
        status = NEW.status,
        tracking_key_hash = NEW.tracking_key_hash,
        tracking_version = NEW.tracking_version,
        progress_version = NEW.progress_version,
        last_progress_id = NEW.last_progress_id,
        privacy_version = NEW.privacy_version,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id character varying(64) NOT NULL,
    email character varying(128) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(128) NOT NULL,
    role character varying(64) DEFAULT 'admin'::character varying NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login timestamp with time zone
);


--
-- Name: asignacion_ajustador; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asignacion_ajustador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    ajustador_id uuid NOT NULL,
    asignado_por uuid,
    fecha_asignacion timestamp with time zone DEFAULT now(),
    estado character varying(30) DEFAULT 'activo'::character varying,
    observaciones text
);


--
-- Name: auditoria_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid,
    usuario_id uuid,
    accion character varying(100) NOT NULL,
    detalles jsonb,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: carousel_slides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carousel_slides (
    id character varying(64) NOT NULL,
    badge character varying(128) NOT NULL,
    title character varying(255) NOT NULL,
    highlight character varying(255) NOT NULL,
    description text NOT NULL,
    image character varying(255) NOT NULL,
    tag character varying(128) NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: catalogo_liquidador; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_liquidador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    liquidador_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    vigente boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: catalogo_proceso_constructivo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_proceso_constructivo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(255) NOT NULL,
    descripcion text,
    unidad_id character varying(20) NOT NULL,
    categoria character varying(100) NOT NULL,
    regla_calculo character varying(50) DEFAULT 'direct'::character varying,
    precio_referencial numeric(14,2) DEFAULT 1000.00 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: cms_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_videos (
    id character varying(64) NOT NULL,
    title character varying(255) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    damage character varying(64) DEFAULT ''::character varying NOT NULL,
    commune character varying(128) DEFAULT ''::character varying NOT NULL,
    provider character varying(32) NOT NULL,
    video_id character varying(64) NOT NULL,
    poster character varying(255) DEFAULT ''::character varying NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    consent_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: email_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_notifications (
    id character varying(64) NOT NULL,
    inquiry_id character varying(64) NOT NULL,
    kind character varying(64) NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    encrypted_payload text,
    attempts integer DEFAULT 0 NOT NULL,
    first_attempt_at bigint,
    next_attempt_at bigint DEFAULT 0 NOT NULL,
    lease_until bigint DEFAULT 0 NOT NULL,
    lease_token character varying(64),
    provider_id character varying(128),
    error_code character varying(64),
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
);


--
-- Name: estado_expediente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estado_expediente (
    id character varying(30) NOT NULL,
    nombre character varying(60) NOT NULL,
    descripcion character varying(255),
    color character varying(30) DEFAULT '#0284c7'::character varying,
    badge_clase character varying(50) DEFAULT 'blue lighten-5 blue-text text-darken-3'::character varying,
    orden integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: etapa_expediente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etapa_expediente (
    id character varying(50) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion_publica text,
    orden integer NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: evaluation_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluation_configs (
    key character varying(64) NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: evidencia_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidencia_eventos (
    id bigint NOT NULL,
    fotografia_id uuid NOT NULL,
    usuario_id uuid,
    tipo_evento character varying(60) NOT NULL,
    descripcion text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: evidencia_eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evidencia_eventos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evidencia_eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evidencia_eventos_id_seq OWNED BY public.evidencia_eventos.id;


--
-- Name: expediente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expediente (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(50) NOT NULL,
    cliente_nombre character varying(200) NOT NULL,
    cliente_rut character varying(20) NOT NULL,
    cliente_telefono character varying(50),
    cliente_email character varying(150),
    direccion character varying(255) NOT NULL,
    comuna character varying(100) NOT NULL,
    ciudad character varying(100),
    region character varying(100),
    banco_beneficiario character varying(150),
    aseguradora character varying(150),
    liquidador_id uuid NOT NULL,
    numero_poliza character varying(100),
    numero_siniestro character varying(100),
    tipo_evento character varying(100) DEFAULT 'Sismo'::character varying NOT NULL,
    tipo_inmueble character varying(100) DEFAULT 'Casa'::character varying NOT NULL,
    sistema_constructivo character varying(100) DEFAULT 'Albañilería confinada'::character varying,
    fecha_evento date,
    fecha_visita date DEFAULT CURRENT_DATE NOT NULL,
    inspector_id uuid,
    inspector_nombre character varying(150),
    inspector_cargo character varying(150) DEFAULT 'Inspector de terreno'::character varying,
    supervisor_nombre character varying(150),
    revisado boolean DEFAULT false NOT NULL,
    observaciones_generales text,
    observaciones_tecnicas text,
    observaciones_seguridad text,
    conclusion text,
    porcentaje_gg numeric(5,2) DEFAULT 0.00 NOT NULL,
    porcentaje_utilidad numeric(5,2) DEFAULT 0.00 NOT NULL,
    tasa_iva numeric(5,2) DEFAULT 19.00 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    estado character varying(30) DEFAULT 'activo'::character varying NOT NULL,
    avance_porcentaje integer DEFAULT 0,
    etapa_actual character varying(50) DEFAULT 'evidencia'::character varying,
    ajustador_id uuid,
    ajustador_nombre character varying(150),
    estado_presupuesto character varying(40) DEFAULT 'pendiente_cuantificacion'::character varying
);


--
-- Name: expediente_cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expediente_cliente (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    titular boolean DEFAULT true NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: expediente_etapa_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expediente_etapa_historial (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    etapa_id character varying(50) NOT NULL,
    estado_proceso character varying(30) DEFAULT 'completada'::character varying NOT NULL,
    fecha_inicio timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_fin timestamp with time zone,
    descripcion_interna text,
    descripcion_publica text NOT NULL,
    visible_cliente boolean DEFAULT true NOT NULL,
    usuario_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT expediente_etapa_historial_estado_proceso_check CHECK (((estado_proceso)::text = ANY ((ARRAY['completada'::character varying, 'en_curso'::character varying, 'pendiente'::character varying, 'observada'::character varying])::text[])))
);


--
-- Name: fotografia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fotografia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    partida_id uuid,
    nombre_archivo character varying(255) NOT NULL,
    ruta_almacenamiento character varying(500) NOT NULL,
    sector character varying(100) NOT NULL,
    descripcion text,
    mime_type character varying(50) NOT NULL,
    tamano_bytes bigint NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sector_id uuid,
    dano_id uuid,
    nombre_original character varying(255),
    usuario_id uuid,
    fecha_captura timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    ruta_thumbnail character varying(500),
    visible_cliente boolean DEFAULT true NOT NULL
);


--
-- Name: gasto_caso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gasto_caso (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    categoria character varying(150) NOT NULL,
    descripcion text NOT NULL,
    unidad character varying(20) DEFAULT 'gl'::character varying NOT NULL,
    cantidad numeric(12,3) DEFAULT 1.0 NOT NULL,
    precio_unitario_neto numeric(14,2) NOT NULL,
    subtotal_neto numeric(14,2) NOT NULL,
    verificado boolean DEFAULT false NOT NULL,
    fuente text,
    fecha_cotizacion date
);


--
-- Name: gasto_plantilla; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gasto_plantilla (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    catalogo_id uuid NOT NULL,
    codigo character varying(50) NOT NULL,
    categoria character varying(150) NOT NULL,
    descripcion text NOT NULL,
    unidad character varying(20) DEFAULT 'gl'::character varying NOT NULL,
    precio_unitario numeric(14,2),
    incluye_iva boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: historial_precio_proceso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historial_precio_proceso (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proceso_id uuid NOT NULL,
    valor_unitario numeric(14,2) NOT NULL,
    moneda character varying(10) DEFAULT 'CLP'::character varying NOT NULL,
    fecha_vigencia date DEFAULT CURRENT_DATE NOT NULL,
    ajustador_id uuid,
    expediente_id uuid,
    observacion text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inquiries (
    id character varying(64) NOT NULL,
    reference character varying(32) NOT NULL,
    request_id character varying(64) NOT NULL,
    owner_id character varying(128),
    damage_type character varying(64) NOT NULL,
    stage character varying(64) NOT NULL,
    insurance character varying(128) NOT NULL,
    region character varying(64) NOT NULL,
    commune character varying(64) NOT NULL,
    address_encrypted bytea,
    financial_institution character varying(128),
    case_type character varying(64),
    mass_event_id character varying(64),
    event_date character varying(32),
    description_encrypted bytea NOT NULL,
    name_encrypted bytea NOT NULL,
    email_encrypted bytea NOT NULL,
    email_hash character varying(64) NOT NULL,
    phone_encrypted bytea,
    status character varying(32) DEFAULT 'recibida'::character varying NOT NULL,
    tracking_key_hash character varying(128),
    tracking_version integer DEFAULT 0 NOT NULL,
    progress_version integer DEFAULT 0 NOT NULL,
    last_progress_id character varying(64),
    privacy_version character varying(32) NOT NULL,
    consented_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inquiry_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inquiry_events (
    id character varying(64) NOT NULL,
    inquiry_id character varying(64) NOT NULL,
    kind character varying(64) NOT NULL,
    message_encrypted bytea NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: liquidador; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquidador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(200) NOT NULL,
    rut character varying(20),
    email_contacto character varying(150),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: material_liquidador; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_liquidador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    catalogo_id uuid NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(255) NOT NULL,
    categoria character varying(150) NOT NULL,
    unidad character varying(20) NOT NULL,
    especificacion text,
    presentacion_cantidad numeric(12,4) DEFAULT 1.0 NOT NULL,
    presentacion_unidad character varying(20) NOT NULL,
    precio_presentacion numeric(14,2),
    incluye_iva boolean DEFAULT true NOT NULL,
    tasa_iva numeric(5,2) DEFAULT 19.00 NOT NULL,
    proveedor character varying(200),
    fuente_cotizacion text,
    fecha_precio date,
    region character varying(100),
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: partida_dano; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partida_dano (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    sector character varying(100) NOT NULL,
    elemento character varying(100) NOT NULL,
    dano_tipo character varying(100) NOT NULL,
    material_existente text,
    descripcion_dano text NOT NULL,
    reparacion_propuesta character varying(255) NOT NULL,
    proceso_id uuid,
    es_estructural boolean DEFAULT false NOT NULL,
    referencia_estructural text,
    unidad_id character varying(20) NOT NULL,
    metodo_calculo character varying(20) NOT NULL,
    largo numeric(10,3) DEFAULT 0 NOT NULL,
    ancho numeric(10,3) DEFAULT 0 NOT NULL,
    alto numeric(10,3) DEFAULT 0 NOT NULL,
    cantidad_directa numeric(12,3) DEFAULT 0 NOT NULL,
    descuento numeric(12,3) DEFAULT 0 NOT NULL,
    porcentaje_afectado numeric(5,2) DEFAULT 100.00 NOT NULL,
    cantidad_medida numeric(12,3) DEFAULT 0 NOT NULL,
    cantidad_reparacion numeric(12,3),
    justificacion_reparacion text,
    modo_precio character varying(20) DEFAULT 'complete'::character varying NOT NULL,
    precio_unitario_neto numeric(14,2),
    incluye_iva boolean DEFAULT false NOT NULL,
    tasa_iva numeric(5,2) DEFAULT 19.00 NOT NULL,
    subtotal_neto numeric(14,2) DEFAULT 0 NOT NULL,
    precio_verificado boolean DEFAULT false NOT NULL,
    fuente_precio text,
    proveedor_precio character varying(200),
    fecha_cotizacion date,
    region_cotizacion character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sector_id uuid,
    materialidad character varying(150),
    cantidad_afectada numeric(12,3),
    porcentaje_intervencion numeric(5,2) DEFAULT 100.00,
    CONSTRAINT partida_dano_metodo_calculo_check CHECK (((metodo_calculo)::text = ANY ((ARRAY['LH'::character varying, 'LW'::character varying, 'perimeter'::character varying, 'LWH'::character varying, 'L'::character varying, 'direct'::character varying])::text[]))),
    CONSTRAINT partida_dano_modo_precio_check CHECK (((modo_precio)::text = ANY ((ARRAY['complete'::character varying, 'apu'::character varying])::text[]))),
    CONSTRAINT partida_dano_porcentaje_afectado_check CHECK (((porcentaje_afectado > (0)::numeric) AND (porcentaje_afectado <= (100)::numeric)))
);


--
-- Name: partida_presupuesto_ajuste; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partida_presupuesto_ajuste (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    presupuesto_id uuid NOT NULL,
    expediente_id uuid NOT NULL,
    sector_id uuid,
    sector_nombre character varying(150),
    dano_id uuid,
    dano_descripcion text,
    proceso_id uuid,
    proceso_codigo character varying(50),
    proceso_nombre character varying(255) NOT NULL,
    categoria character varying(100) DEFAULT 'Terminaciones'::character varying NOT NULL,
    unidad_id character varying(20) NOT NULL,
    cantidad_base numeric(12,3) DEFAULT 0.000 NOT NULL,
    cantidad numeric(12,3) DEFAULT 0.000 NOT NULL,
    justificacion_cantidad text,
    valor_unitario numeric(14,2) DEFAULT 0.00 NOT NULL,
    subtotal numeric(14,2) DEFAULT 0.00 NOT NULL,
    es_gasto_general boolean DEFAULT false NOT NULL,
    orden integer DEFAULT 1,
    usuario_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: presupuesto_ajuste; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presupuesto_ajuste (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    ajustador_id uuid,
    version integer DEFAULT 1 NOT NULL,
    estado character varying(40) DEFAULT 'borrador'::character varying NOT NULL,
    costo_directo numeric(14,2) DEFAULT 0.00 NOT NULL,
    porcentaje_gg numeric(5,2) DEFAULT 25.00 NOT NULL,
    monto_gg numeric(14,2) DEFAULT 0.00 NOT NULL,
    neto numeric(14,2) DEFAULT 0.00 NOT NULL,
    porcentaje_iva numeric(5,2) DEFAULT 19.00 NOT NULL,
    monto_iva numeric(14,2) DEFAULT 0.00 NOT NULL,
    total numeric(14,2) DEFAULT 0.00 NOT NULL,
    observaciones_ajustador text,
    observaciones_revision text,
    aprobado_por uuid,
    fecha_aprobacion timestamp with time zone,
    fecha_envio_revision timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT presupuesto_ajuste_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente_cuantificacion'::character varying, 'en_cuantificacion'::character varying, 'borrador'::character varying, 'enviado_revision'::character varying, 'observado'::character varying, 'aprobado'::character varying, 'rechazado'::character varying])::text[])))
);


--
-- Name: proceso_liquidador; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proceso_liquidador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    catalogo_id uuid NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(255) NOT NULL,
    categoria character varying(150) NOT NULL,
    unidad character varying(20) NOT NULL,
    precio_unitario numeric(14,2),
    incluye_iva boolean DEFAULT false NOT NULL,
    tasa_iva numeric(5,2) DEFAULT 19.00 NOT NULL,
    fuente text,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: progress_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progress_updates (
    id character varying(64) NOT NULL,
    inquiry_id character varying(64) NOT NULL,
    status character varying(64) NOT NULL,
    actor_id character varying(128) NOT NULL,
    sequence integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    key character varying(255) NOT NULL,
    count integer DEFAULT 1 NOT NULL,
    expires_at bigint NOT NULL
);


--
-- Name: recurso_apu; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurso_apu (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partida_id uuid NOT NULL,
    material_id uuid,
    nombre character varying(255) NOT NULL,
    especificacion text,
    unidad character varying(20) NOT NULL,
    consumo_unitario numeric(12,4) NOT NULL,
    presentacion_cantidad numeric(12,4) DEFAULT 1.0 NOT NULL,
    presentacion_unidad character varying(20) NOT NULL,
    precio_presentacion_neto numeric(14,2) NOT NULL,
    capas_manos integer DEFAULT 1 NOT NULL,
    porcentaje_merma numeric(5,2) DEFAULT 0 NOT NULL,
    costo_total_neto numeric(14,2) NOT NULL,
    verificado boolean DEFAULT false NOT NULL
);


--
-- Name: sector_expediente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sector_expediente (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    estado character varying(30) DEFAULT 'activo'::character varying NOT NULL,
    usuario_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: unidad_medida; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unidad_medida (
    id character varying(20) NOT NULL,
    etiqueta character varying(50) NOT NULL,
    dimension character varying(20) NOT NULL,
    escala numeric(12,4) DEFAULT 1.0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT unidad_medida_dimension_check CHECK (((dimension)::text = ANY ((ARRAY['area'::character varying, 'volume'::character varying, 'length'::character varying, 'count'::character varying, 'direct'::character varying])::text[])))
);


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(150) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    rol public.user_role DEFAULT 'inspector'::public.user_role NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    doble_perfil boolean DEFAULT false NOT NULL,
    roles text[] DEFAULT ARRAY['inspector'::text],
    CONSTRAINT chk_cliente_rol_exclusivo CHECK ((((rol = 'cliente'::public.user_role) AND (doble_perfil = false) AND (roles = ARRAY['cliente'::text])) OR ((rol <> 'cliente'::public.user_role) AND (NOT ('cliente'::text = ANY (roles))))))
);


--
-- Name: v_inquiries; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_inquiries AS
 SELECT id,
    reference,
    request_id,
    owner_id,
    damage_type,
    stage,
    insurance,
    region,
    commune,
    public.fn_decrypt_field(address_encrypted) AS address,
    financial_institution,
    case_type,
    mass_event_id,
    event_date,
    public.fn_decrypt_field(description_encrypted) AS description,
    public.fn_decrypt_field(name_encrypted) AS name,
    public.fn_decrypt_field(email_encrypted) AS email,
    email_hash,
    public.fn_decrypt_field(phone_encrypted) AS phone,
    status,
    tracking_key_hash,
    tracking_version,
    progress_version,
    last_progress_id,
    privacy_version,
    consented_at,
    created_at,
    updated_at
   FROM public.inquiries;


--
-- Name: v_inquiry_events; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_inquiry_events AS
 SELECT id,
    inquiry_id,
    kind,
    public.fn_decrypt_field(message_encrypted) AS message,
    created_at
   FROM public.inquiry_events;


--
-- Name: version_informe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.version_informe (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    correlativo character varying(50) NOT NULL,
    es_valorizado boolean DEFAULT true NOT NULL,
    costo_directo numeric(14,2) NOT NULL,
    gastos_generales numeric(14,2) NOT NULL,
    utilidad numeric(14,2) NOT NULL,
    subtotal_neto numeric(14,2) NOT NULL,
    iva numeric(14,2) NOT NULL,
    total_presupuesto numeric(14,2) NOT NULL,
    snapshot_json jsonb NOT NULL,
    supervisor_aprobador character varying(150),
    emitido_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: evidencia_eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia_eventos ALTER COLUMN id SET DEFAULT nextval('public.evidencia_eventos_id_seq'::regclass);


--
-- Data for Name: admin_users; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: asignacion_ajustador; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: auditoria_log; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: carousel_slides; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: catalogo_liquidador; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.catalogo_liquidador (id, liquidador_id, version, vigente, updated_at) VALUES ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 1, true, '2026-11-04 20:56:23.735298-03');


--
-- Data for Name: catalogo_proceso_constructivo; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.catalogo_proceso_constructivo (id, codigo, nombre, descripcion, unidad_id, categoria, regla_calculo, precio_referencial, activo, created_at, updated_at) VALUES ('a9c73169-1d9a-4eb8-b59c-dc1f91b0e2b7', 'PREP-SUP', 'Preparación de superficie', 'Limpieza, desbaste y acondicionamiento de superficie a intervenir', 'm²', 'Terminaciones', 'cielo_muro', 1000.00, true, '2026-11-21 22:38:46.570011-03', '2026-11-21 22:38:46.570011-03');
INSERT INTO public.catalogo_proceso_constructivo (id, codigo, nombre, descripcion, unidad_id, categoria, regla_calculo, precio_referencial, activo, created_at, updated_at) VALUES ('50e57d39-b481-496e-88e8-c69f62a4522e', 'EMP-ML', 'Provisión y aplicación de empaste', 'Empastado en fisuras y paramentos previa pintura', 'ml', 'Terminaciones', 'fisura_lineal', 1000.00, true, '2026-11-21 22:38:46.577105-03', '2026-11-21 22:38:46.577105-03');
INSERT INTO public.catalogo_proceso_constructivo (id, codigo, nombre, descripcion, unidad_id, categoria, regla_calculo, precio_referencial, activo, created_at, updated_at) VALUES ('ca83e784-66dd-4e5b-a144-0bfee2678fb2', 'REP-FIS', 'Reparación de fisura', 'Apertura en V, puente de adherencia y masillado elástico', 'ml', 'Albañilería', 'fisura_lineal', 1000.00, true, '2026-11-21 22:38:46.578793-03', '2026-11-21 22:38:46.578793-03');
INSERT INTO public.catalogo_proceso_constructivo (id, codigo, nombre, descripcion, unidad_id, categoria, regla_calculo, precio_referencial, activo, created_at, updated_at) VALUES ('9254be82-220e-4870-a527-7c6f433c8043', 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Esmalte al agua o látex profesional 2 manos', 'm²', 'Pintura', 'cielo_muro', 1000.00, true, '2026-11-21 22:38:46.580626-03', '2026-11-21 22:38:46.580626-03');
INSERT INTO public.catalogo_proceso_constructivo (id, codigo, nombre, descripcion, unidad_id, categoria, regla_calculo, precio_referencial, activo, created_at, updated_at) VALUES ('07eef4cd-08e7-4c23-be74-3731452b0e48', 'MART-ML', 'Provisión y aplicación de martelina', 'Texturado y emparejamiento perimetral de grietas', 'ml', 'Terminaciones', 'fisura_lineal', 1000.00, true, '2026-11-21 22:38:46.582224-03', '2026-11-21 22:38:46.582224-03');
INSERT INTO public.catalogo_proceso_constructivo (id, codigo, nombre, descripcion, unidad_id, categoria, regla_calculo, precio_referencial, activo, created_at, updated_at) VALUES ('f6354448-1cab-4229-a2da-3cb7da1d6e79', 'PAP-RET', 'Retiro de papel mural', 'Decapado y retiro cuidadoso de papel mural afectado', 'm²', 'Terminaciones', 'muro_area', 3200.00, true, '2026-11-21 22:38:46.583999-03', '2026-11-21 22:38:46.583999-03');
INSERT INTO public.catalogo_proceso_constructivo (id, codigo, nombre, descripcion, unidad_id, categoria, regla_calculo, precio_referencial, activo, created_at, updated_at) VALUES ('30d1e903-8b46-4010-8208-36827723ff65', 'PAP-COL', 'Provisión y colocación de papel mural', 'Colocación de papel vinílico o texturado similar al existente', 'm²', 'Terminaciones', 'muro_area', 3200.00, true, '2026-11-21 22:38:46.585505-03', '2026-11-21 22:38:46.585505-03');
INSERT INTO public.catalogo_proceso_constructivo (id, codigo, nombre, descripcion, unidad_id, categoria, regla_calculo, precio_referencial, activo, created_at, updated_at) VALUES ('d9058767-ae91-46d4-a16c-e5fccfdada10', 'GG-FLETE', 'Flete', 'Transporte y logística de materiales a obra', 'gl', 'Gastos Generales', 'direct', 1810.00, true, '2026-11-21 22:38:46.586762-03', '2026-11-21 22:38:46.586762-03');
INSERT INTO public.catalogo_proceso_constructivo (id, codigo, nombre, descripcion, unidad_id, categoria, regla_calculo, precio_referencial, activo, created_at, updated_at) VALUES ('5be4e494-ac3c-47ed-a33c-5cdf7b5c4d97', 'GG-ESCOMB', 'Retiro de escombros', 'Carguío y retiro de escombros a botadero autorizado', 'gl', 'Gastos Generales', 'direct', 1810.00, true, '2026-11-21 22:38:46.588278-03', '2026-11-21 22:38:46.588278-03');
INSERT INTO public.catalogo_proceso_constructivo (id, codigo, nombre, descripcion, unidad_id, categoria, regla_calculo, precio_referencial, activo, created_at, updated_at) VALUES ('a8dcf508-b56b-4f27-8fc5-4618ff559932', 'GG-ASEO', 'Aseo y entrega final', 'Aseo fino y entrega de recintos habitables', 'gl', 'Gastos Generales', 'direct', 1810.00, true, '2026-11-21 22:38:46.589571-03', '2026-11-21 22:38:46.589571-03');
INSERT INTO public.catalogo_proceso_constructivo (id, codigo, nombre, descripcion, unidad_id, categoria, regla_calculo, precio_referencial, activo, created_at, updated_at) VALUES ('c4f622ac-1ade-48a6-8c6d-c2761ff96685', 'GG-PROT', 'Protección de área de trabajo', 'Polietileno y encintado de protección de bienes y pisos', 'gl', 'Gastos Generales', 'direct', 1810.00, true, '2026-11-21 22:38:46.590832-03', '2026-11-21 22:38:46.590832-03');


--
-- Data for Name: cms_videos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: email_notifications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: estado_expediente; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.estado_expediente (id, nombre, descripcion, color, badge_clase, orden, created_at) VALUES ('activo', 'Activo', 'Expediente en curso de inspección activa', '#10b981', 'green lighten-5 green-text text-darken-3', 1, '2026-11-05 22:17:47.11954-03');
INSERT INTO public.estado_expediente (id, nombre, descripcion, color, badge_clase, orden, created_at) VALUES ('en_espera', 'En espera', 'Expediente pausado, en espera de documentación o peritaje', '#f59e0b', 'amber lighten-5 amber-text text-darken-4', 2, '2026-11-05 22:17:47.11954-03');
INSERT INTO public.estado_expediente (id, nombre, descripcion, color, badge_clase, orden, created_at) VALUES ('procesado', 'Procesado', 'Expediente liquidado, revisado y procesado oficialmente', '#3b82f6', 'blue lighten-5 blue-text text-darken-3', 3, '2026-11-05 22:17:47.11954-03');


--
-- Data for Name: etapa_expediente; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.etapa_expediente (id, nombre, descripcion_publica, orden, activo) VALUES ('ingresado', 'Expediente ingresado', 'Recepción formal del denuncio y creación del expediente de siniestro.', 1, true);
INSERT INTO public.etapa_expediente (id, nombre, descripcion_publica, orden, activo) VALUES ('asignacion_inspector', 'Asignación de inspector', 'Designación del perito inspector responsable de la evaluación.', 2, true);
INSERT INTO public.etapa_expediente (id, nombre, descripcion_publica, orden, activo) VALUES ('visita_programada', 'Visita programada', 'Coordinación y calendarización de la inspección pericial en el inmueble.', 3, true);
INSERT INTO public.etapa_expediente (id, nombre, descripcion_publica, orden, activo) VALUES ('inspeccion_terreno', 'Inspección en terreno', 'Levantamiento pericial de daños, mediciones y antecedentes en sitio.', 4, true);
INSERT INTO public.etapa_expediente (id, nombre, descripcion_publica, orden, activo) VALUES ('evidencia', 'Evidencia', 'Revisión, procesamiento técnico y validación de las evidencias fotográficas.', 5, true);
INSERT INTO public.etapa_expediente (id, nombre, descripcion_publica, orden, activo) VALUES ('revision_tecnica', 'Revisión técnica', 'Análisis de daños estructurales y verificación pericial de partidas.', 6, true);
INSERT INTO public.etapa_expediente (id, nombre, descripcion_publica, orden, activo) VALUES ('cuantificacion', 'Cuantificación', 'Cálculo de presupuestos, metrajes y costos directos de reparación.', 7, true);
INSERT INTO public.etapa_expediente (id, nombre, descripcion_publica, orden, activo) VALUES ('liquidacion', 'Liquidación', 'Determinación de cobertura y emisión del informe oficial de liquidación.', 8, true);
INSERT INTO public.etapa_expediente (id, nombre, descripcion_publica, orden, activo) VALUES ('finalizado', 'Proceso finalizado', 'Expediente cerrado y formalmente tramitado.', 9, true);


--
-- Data for Name: evaluation_configs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: evidencia_eventos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.evidencia_eventos (id, fotografia_id, usuario_id, tipo_evento, descripcion, metadata, created_at) VALUES (15, '5491626b-09cd-4730-9ade-beccadee8730', 'a0000000-0000-0000-0000-000000000001', 'FOTO_REGISTRADA', 'Fotografía pericial capturada en terreno (WhatsApp Image 2026-11-15 at 2.10.01 PM.jpeg)', '{"mime_type": "image/jpeg", "nombre_original": "WhatsApp Image 2026-11-15 at 2.10.01 PM.jpeg"}', '2026-11-18 20:51:14.185-03');
INSERT INTO public.evidencia_eventos (id, fotografia_id, usuario_id, tipo_evento, descripcion, metadata, created_at) VALUES (16, '5491626b-09cd-4730-9ade-beccadee8730', 'a0000000-0000-0000-0000-000000000001', 'ARCHIVO_ALMACENADO', 'Archivo almacenado en almacenamiento persistente (169.7 KB)', '{"ruta": "expedientes/d0000000-0000-0000-0000-000000000003/originales/a8280abc-6d83-4234-b4f0-ab584d1f5057.jpeg", "tamano_bytes": "173764"}', '2026-11-18 20:51:14.185-03');
INSERT INTO public.evidencia_eventos (id, fotografia_id, usuario_id, tipo_evento, descripcion, metadata, created_at) VALUES (17, '5491626b-09cd-4730-9ade-beccadee8730', 'a0000000-0000-0000-0000-000000000001', 'SECTOR_ASOCIADO', 'Evidencia asociada al sector "BAÑO NUEVO"', '{"sector": "BAÑO NUEVO", "sector_id": "ce2845c5-ba8e-4a00-9858-14ef42a9cf4b"}', '2026-11-18 20:51:14.185-03');


--
-- Data for Name: expediente; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.expediente (id, codigo, cliente_nombre, cliente_rut, cliente_telefono, cliente_email, direccion, comuna, ciudad, region, banco_beneficiario, aseguradora, liquidador_id, numero_poliza, numero_siniestro, tipo_evento, tipo_inmueble, sistema_constructivo, fecha_evento, fecha_visita, inspector_id, inspector_nombre, inspector_cargo, supervisor_nombre, revisado, observaciones_generales, observaciones_tecnicas, observaciones_seguridad, conclusion, porcentaje_gg, porcentaje_utilidad, tasa_iva, created_at, updated_at, estado, avance_porcentaje, etapa_actual, ajustador_id, ajustador_nombre, estado_presupuesto) VALUES ('d0000000-0000-0000-0000-000000000003', 'SIS-2026-086', 'Roberto Silva', '9.765.432-1', '+56 9 6543 2109', 'roberto.silva@empresa.cl', 'Pasaje Central 128, Pozo Almonte', 'Pozo Almonte', 'Pozo Almonte', NULL, NULL, NULL, 'b0000000-0000-0000-0000-000000000002', 'POL-66542-2026', 'SIN-339811', 'Inundación Matriz', 'Local Comercial', 'Albañilería', '2026-05-20', '2026-05-22', 'a0000000-0000-0000-0000-000000000001', 'Pedro Pérez (Inspector)', 'Inspector de terreno', NULL, false, NULL, NULL, NULL, NULL, 20.00, 5.00, 19.00, '2026-11-05 22:17:47.11954-03', '2026-11-21 21:45:42.179869-03', 'procesado', 100, 'finalizado', 'a0000000-0000-0000-0000-000000000020', 'Carlos Mendoza (Ajustador)', 'aprobado');
INSERT INTO public.expediente (id, codigo, cliente_nombre, cliente_rut, cliente_telefono, cliente_email, direccion, comuna, ciudad, region, banco_beneficiario, aseguradora, liquidador_id, numero_poliza, numero_siniestro, tipo_evento, tipo_inmueble, sistema_constructivo, fecha_evento, fecha_visita, inspector_id, inspector_nombre, inspector_cargo, supervisor_nombre, revisado, observaciones_generales, observaciones_tecnicas, observaciones_seguridad, conclusion, porcentaje_gg, porcentaje_utilidad, tasa_iva, created_at, updated_at, estado, avance_porcentaje, etapa_actual, ajustador_id, ajustador_nombre, estado_presupuesto) VALUES ('d0000000-0000-0000-0000-000000000001', 'SIS-2026-084', 'Juan Pérez', '12.345.678-9', '+56 9 8765 4321', 'juan.perez@gmail.com', 'Av. Arturo Prat 2043, Alto Hospicio', 'Alto Hospicio', 'Alto Hospicio', NULL, NULL, NULL, 'b0000000-0000-0000-0000-000000000001', 'POL-99281-2026', 'SIN-881273', 'Sismo', 'Casa de dos pisos', 'Albañilería confinada', '2026-05-31', '2026-06-02', 'a0000000-0000-0000-0000-000000000001', 'Pedro Pérez (Inspector)', 'Inspector de terreno', NULL, false, NULL, NULL, NULL, NULL, 25.00, 0.00, 19.00, '2026-11-04 20:56:23.753501-03', '2026-11-04 20:56:23.753501-03', 'activo', 60, 'evidencia', 'a0000000-0000-0000-0000-000000000020', 'Carlos Mendoza (Ajustador)', 'pendiente_cuantificacion');
INSERT INTO public.expediente (id, codigo, cliente_nombre, cliente_rut, cliente_telefono, cliente_email, direccion, comuna, ciudad, region, banco_beneficiario, aseguradora, liquidador_id, numero_poliza, numero_siniestro, tipo_evento, tipo_inmueble, sistema_constructivo, fecha_evento, fecha_visita, inspector_id, inspector_nombre, inspector_cargo, supervisor_nombre, revisado, observaciones_generales, observaciones_tecnicas, observaciones_seguridad, conclusion, porcentaje_gg, porcentaje_utilidad, tasa_iva, created_at, updated_at, estado, avance_porcentaje, etapa_actual, ajustador_id, ajustador_nombre, estado_presupuesto) VALUES ('d0000000-0000-0000-0000-000000000002', 'SIS-2026-085', 'María González', '14.892.123-K', '+56 9 7654 3210', 'maria.gonzalez@gmail.com', 'Calle Los Álamos 450, Iquique', 'Iquique', 'Iquique', NULL, NULL, NULL, 'b0000000-0000-0000-0000-000000000001', 'POL-77123-2026', 'SIN-449102', 'Incendio parcial', 'Departamento', 'Hormigón armado', '2026-06-01', '2026-06-03', 'a0000000-0000-0000-0000-000000000001', 'Pedro Pérez (Inspector)', 'Inspector de terreno', NULL, false, NULL, NULL, NULL, NULL, 25.00, 0.00, 19.00, '2026-11-05 22:17:47.11954-03', '2026-11-21 22:13:47.746611-03', 'procesado', 100, 'visita_programada', 'a0000000-0000-0000-0000-000000000020', 'Carlos Mendoza (Ajustador)', 'pendiente_cuantificacion');


--
-- Data for Name: expediente_cliente; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.expediente_cliente (id, expediente_id, usuario_id, titular, activo, created_at) VALUES ('cf34789f-4d89-4589-8c7e-de1b25a32305', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000010', true, true, '2026-11-08 00:18:40.343154-03');
INSERT INTO public.expediente_cliente (id, expediente_id, usuario_id, titular, activo, created_at) VALUES ('5c0c937a-d0a9-4c6e-ad10-0ad6cd25bd7b', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000011', true, true, '2026-11-08 00:18:40.376645-03');
INSERT INTO public.expediente_cliente (id, expediente_id, usuario_id, titular, activo, created_at) VALUES ('12a937d3-5ee2-486f-823c-b45df4ad6244', 'd0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000012', true, true, '2026-11-08 00:18:40.382494-03');


--
-- Data for Name: expediente_etapa_historial; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('3dbf300f-87c2-4e37-8073-31b6fc1ab289', 'd0000000-0000-0000-0000-000000000001', 'ingresado', 'completada', '2026-05-31 09:30:00-04', '2026-05-31 10:15:00-04', NULL, 'Denuncio recepcionado correctamente en plataforma oficial Lorens.', true, NULL, '2026-11-08 00:18:40.370018-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('f219f974-d98a-4ca7-81da-b7c45b5869c0', 'd0000000-0000-0000-0000-000000000001', 'asignacion_inspector', 'completada', '2026-05-31 11:00:00-04', '2026-05-31 11:45:00-04', NULL, 'Perito inspector Pedro Pérez asignado al caso pericial.', true, NULL, '2026-11-08 00:18:40.370018-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('55b8cef7-2f34-4cba-9a5c-091ff5ae43e5', 'd0000000-0000-0000-0000-000000000001', 'visita_programada', 'completada', '2026-06-01 10:00:00-04', '2026-06-01 16:30:00-04', NULL, 'Visita pericial confirmada y coordinada para el 02/06/2026.', true, NULL, '2026-11-08 00:18:40.370018-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('ceb5314b-99f4-4896-89d2-fc3e704647e0', 'd0000000-0000-0000-0000-000000000001', 'inspeccion_terreno', 'completada', '2026-06-02 09:00:00-04', '2026-06-02 12:30:00-04', NULL, 'Inspección de daños realizada exitosamente en el inmueble.', true, NULL, '2026-11-08 00:18:40.370018-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('21a3c522-e30a-4b82-9b0a-94441b7fa0af', 'd0000000-0000-0000-0000-000000000001', 'evidencia', 'en_curso', '2026-06-02 14:00:00-04', NULL, NULL, 'Se está realizando la revisión y organización de antecedentes fotográficos del siniestro.', true, NULL, '2026-11-08 00:18:40.370018-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('23a5eb3b-1f2b-49d8-ad9a-d837b0900038', 'd0000000-0000-0000-0000-000000000002', 'ingresado', 'completada', '2026-06-01 14:20:00-04', '2026-06-01 15:00:00-04', NULL, 'Expediente registrado en el sistema.', true, NULL, '2026-11-08 00:18:40.378384-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('35e78f7b-dedb-4ca8-b350-73f3e494c9c3', 'd0000000-0000-0000-0000-000000000002', 'asignacion_inspector', 'completada', '2026-06-01 16:00:00-04', '2026-06-01 16:30:00-04', NULL, 'Inspector técnico asignado para la atención del siniestro.', true, NULL, '2026-11-08 00:18:40.378384-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('30bc4608-6acf-4ff8-b83c-8ce1c381e5a3', 'd0000000-0000-0000-0000-000000000002', 'visita_programada', 'en_curso', '2026-06-02 09:00:00-04', NULL, NULL, 'En proceso de coordinación telefónica de la fecha de visita pericial.', true, NULL, '2026-11-08 00:18:40.378384-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('aeda69cb-7bfe-4048-85ca-eefc94f38f07', 'd0000000-0000-0000-0000-000000000003', 'ingresado', 'completada', '2026-05-20 08:30:00-04', '2026-05-20 09:00:00-04', NULL, 'Expediente recepcionado.', true, NULL, '2026-11-08 00:18:40.384411-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('36580be1-09e2-4b12-9d1e-a950986c315e', 'd0000000-0000-0000-0000-000000000003', 'asignacion_inspector', 'completada', '2026-05-20 10:00:00-04', '2026-05-20 10:30:00-04', NULL, 'Inspector Pedro Pérez asignado.', true, NULL, '2026-11-08 00:18:40.384411-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('d5ae601b-f476-4f38-85bf-005548e4968a', 'd0000000-0000-0000-0000-000000000003', 'visita_programada', 'completada', '2026-05-21 11:00:00-04', '2026-05-21 17:00:00-04', NULL, 'Visita coordinada.', true, NULL, '2026-11-08 00:18:40.384411-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('d0c0fd98-fda2-48e8-8f77-4e653eb493ef', 'd0000000-0000-0000-0000-000000000003', 'inspeccion_terreno', 'completada', '2026-05-22 09:30:00-04', '2026-05-22 13:00:00-04', NULL, 'Inspección en terreno completada.', true, NULL, '2026-11-08 00:18:40.384411-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('130b6689-0517-4472-857a-7470a7dc9fd6', 'd0000000-0000-0000-0000-000000000003', 'evidencia', 'completada', '2026-05-22 14:00:00-04', '2026-05-23 11:00:00-04', NULL, 'Evidencias fotográficas procesadas y validadas.', true, NULL, '2026-11-08 00:18:40.384411-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('51d0e381-9631-4b73-9579-48c558ff1dca', 'd0000000-0000-0000-0000-000000000003', 'revision_tecnica', 'completada', '2026-05-23 11:30:00-04', '2026-05-24 16:00:00-04', NULL, 'Revisión técnica de partidas aprobada.', true, NULL, '2026-11-08 00:18:40.384411-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('1fd9fa6c-df49-4028-8982-5bfb4cf26c59', 'd0000000-0000-0000-0000-000000000003', 'cuantificacion', 'completada', '2026-05-25 09:00:00-04', '2026-05-25 18:00:00-04', NULL, 'Cálculo de presupuestos y cubicaciones completado.', true, NULL, '2026-11-08 00:18:40.384411-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('904cb0f7-fb64-4c76-8f62-3007e493331d', 'd0000000-0000-0000-0000-000000000003', 'liquidacion', 'completada', '2026-05-26 10:00:00-04', '2026-05-27 15:00:00-04', NULL, 'Informe pericial de liquidación emitido.', true, NULL, '2026-11-08 00:18:40.384411-03');
INSERT INTO public.expediente_etapa_historial (id, expediente_id, etapa_id, estado_proceso, fecha_inicio, fecha_fin, descripcion_interna, descripcion_publica, visible_cliente, usuario_id, created_at) VALUES ('52b8c1b3-9a9d-4885-951a-ee40bfa37226', 'd0000000-0000-0000-0000-000000000003', 'finalizado', 'completada', '2026-05-28 12:00:00-04', '2026-05-28 12:00:00-04', NULL, 'Proceso de siniestro liquidado y cerrado exitosamente.', true, NULL, '2026-11-08 00:18:40.384411-03');


--
-- Data for Name: fotografia; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.fotografia (id, expediente_id, partida_id, nombre_archivo, ruta_almacenamiento, sector, descripcion, mime_type, tamano_bytes, created_at, sector_id, dano_id, nombre_original, usuario_id, fecha_captura, ruta_thumbnail, visible_cliente) VALUES ('2859b2bc-65dd-4156-b3cb-650de545b61a', 'd0000000-0000-0000-0000-000000000003', NULL, '38ca5e89-486a-4cb2-b2c4-32d8b29684bf.jpg', 'expedientes/d0000000-0000-0000-0000-000000000003/originales/38ca5e89-486a-4cb2-b2c4-32d8b29684bf.jpg', 'BAÑO 1', 'Evidencia pericial de terreno en sector BAÑO 1.', 'image/jpeg', 142748, '2026-11-06 10:52:55.622806-03', NULL, NULL, 'auditorio.jpg', 'a0000000-0000-0000-0000-000000000001', '2026-11-06 10:52:55.622-03', 'expedientes/d0000000-0000-0000-0000-000000000003/originales/38ca5e89-486a-4cb2-b2c4-32d8b29684bf.jpg', true);
INSERT INTO public.fotografia (id, expediente_id, partida_id, nombre_archivo, ruta_almacenamiento, sector, descripcion, mime_type, tamano_bytes, created_at, sector_id, dano_id, nombre_original, usuario_id, fecha_captura, ruta_thumbnail, visible_cliente) VALUES ('5e6ad203-b43a-4990-88e2-ed2ef98367c5', 'd0000000-0000-0000-0000-000000000001', NULL, 'evidencia_fachada_084.jpg', 'expedientes/d0000000-0000-0000-0000-000000000001/originales/evidencia_fachada_084.jpg', 'FACHADA', 'Fisuras diagonales en muro principal por asentamiento pericial', 'image/jpeg', 134, '2026-11-08 00:42:20.976297-03', NULL, NULL, 'fachada_muro.jpg', NULL, '2026-11-08 00:42:20.976297-03', 'expedientes/d0000000-0000-0000-0000-000000000001/originales/evidencia_fachada_084.jpg', true);
INSERT INTO public.fotografia (id, expediente_id, partida_id, nombre_archivo, ruta_almacenamiento, sector, descripcion, mime_type, tamano_bytes, created_at, sector_id, dano_id, nombre_original, usuario_id, fecha_captura, ruta_thumbnail, visible_cliente) VALUES ('5491626b-09cd-4730-9ade-beccadee8730', 'd0000000-0000-0000-0000-000000000003', NULL, 'a8280abc-6d83-4234-b4f0-ab584d1f5057.jpeg', 'expedientes/d0000000-0000-0000-0000-000000000003/originales/a8280abc-6d83-4234-b4f0-ab584d1f5057.jpeg', 'BAÑO NUEVO', 'Evidencia pericial de terreno en sector BAÑO NUEVO.', 'image/jpeg', 173764, '2026-11-18 20:51:14.183571-03', 'ce2845c5-ba8e-4a00-9858-14ef42a9cf4b', NULL, 'WhatsApp Image 2026-11-15 at 2.10.01 PM.jpeg', 'a0000000-0000-0000-0000-000000000001', '2026-11-18 20:51:14.183-03', 'expedientes/d0000000-0000-0000-0000-000000000003/originales/a8280abc-6d83-4234-b4f0-ab584d1f5057.jpeg', true);


--
-- Data for Name: gasto_caso; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.gasto_caso (id, expediente_id, categoria, descripcion, unidad, cantidad, precio_unitario_neto, subtotal_neto, verificado, fuente, fecha_cotizacion) VALUES ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Flete', 'Flete de materiales a obra', 'gl', 1.000, 1810.00, 1810.00, true, NULL, NULL);
INSERT INTO public.gasto_caso (id, expediente_id, categoria, descripcion, unidad, cantidad, precio_unitario_neto, subtotal_neto, verificado, fuente, fecha_cotizacion) VALUES ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Retiro de escombros', 'Retiro a vertedero municipal autorizado', 'gl', 1.000, 1810.00, 1810.00, true, NULL, NULL);
INSERT INTO public.gasto_caso (id, expediente_id, categoria, descripcion, unidad, cantidad, precio_unitario_neto, subtotal_neto, verificado, fuente, fecha_cotizacion) VALUES ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Aseo y entrega', 'Aseo y entrega final de sectores intervenidos', 'gl', 1.000, 1810.00, 1810.00, true, NULL, NULL);
INSERT INTO public.gasto_caso (id, expediente_id, categoria, descripcion, unidad, cantidad, precio_unitario_neto, subtotal_neto, verificado, fuente, fecha_cotizacion) VALUES ('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'Protección', 'Protección de áreas de trabajo no dañadas', 'gl', 1.000, 1810.00, 1810.00, true, NULL, NULL);


--
-- Data for Name: gasto_plantilla; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: historial_precio_proceso; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: inquiries; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: inquiry_events; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: liquidador; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.liquidador (id, nombre, rut, email_contacto, activo, created_at, updated_at) VALUES ('b0000000-0000-0000-0000-000000000001', 'SEGURED / COOPER', '76.123.456-7', 'siniestros@segured.cl', true, '2026-11-04 20:56:23.731011-03', '2026-11-04 20:56:23.731011-03');
INSERT INTO public.liquidador (id, nombre, rut, email_contacto, activo, created_at, updated_at) VALUES ('b0000000-0000-0000-0000-000000000002', 'JUAN PABLO VALDIVIESO', '76.987.654-3', 'contacto@jpv.cl', true, '2026-11-04 20:56:23.731011-03', '2026-11-04 20:56:23.731011-03');


--
-- Data for Name: material_liquidador; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: partida_dano; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'Muro', 'Fisura', NULL, 'Fisuras superficiales y desprendimiento', 'Preparación de superficie', NULL, false, NULL, 'm²', 'direct', 2.400, 1.300, 2.400, 0.000, 0.000, 100.00, 12.300, NULL, NULL, 'complete', 1000.00, false, 19.00, 12300.00, true, NULL, NULL, NULL, NULL, '2026-11-04 20:56:23.759476-03', 'f0000000-0000-0000-0000-000000000001', NULL, NULL, 100.00);
INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'Muro', 'Fisura', NULL, 'Fisuras en paño húmedo', 'Provi. y aplicación de empaste', NULL, false, NULL, 'ml', 'direct', 0.000, 0.000, 0.000, 0.000, 0.000, 100.00, 1.500, NULL, NULL, 'complete', 1000.00, false, 19.00, 1500.00, true, NULL, NULL, NULL, NULL, '2026-11-04 20:56:23.759476-03', 'f0000000-0000-0000-0000-000000000001', NULL, NULL, 100.00);
INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'Muro', 'Fisura', NULL, 'Tratamiento de grieta no estructural', 'Reparación de Fisura', NULL, false, NULL, 'ml', 'direct', 0.000, 0.000, 0.000, 0.000, 0.000, 100.00, 1.500, NULL, NULL, 'complete', 1000.00, false, 19.00, 1500.00, true, NULL, NULL, NULL, NULL, '2026-11-04 20:56:23.759476-03', 'f0000000-0000-0000-0000-000000000001', NULL, NULL, 100.00);
INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'Muro', 'Terminación', NULL, 'Pintura esmalte al agua', 'Provi. y aplicación de pintura dos manos', NULL, false, NULL, 'm²', 'direct', 2.400, 1.300, 2.400, 0.000, 0.000, 100.00, 13.500, NULL, NULL, 'complete', 1000.00, false, 19.00, 13500.00, true, NULL, NULL, NULL, NULL, '2026-11-04 20:56:23.759476-03', 'f0000000-0000-0000-0000-000000000001', NULL, NULL, 100.00);
INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'Muro', 'Terminación', NULL, 'Revestimiento martelina', 'Provi. y aplicación de martelina', NULL, false, NULL, 'ml', 'direct', 0.000, 0.000, 0.000, 0.000, 0.000, 100.00, 1.500, NULL, NULL, 'complete', 1000.00, false, 19.00, 1500.00, true, NULL, NULL, NULL, NULL, '2026-11-04 20:56:23.759476-03', 'f0000000-0000-0000-0000-000000000001', NULL, NULL, 100.00);
INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('6c9e86d8-10a4-4061-a8a4-206031db3f8a', 'd0000000-0000-0000-0000-000000000002', 'PATIO E2E 328', 'Muro exterior', 'Grieta diagonal', '', 'Fisura producida por asentamiento diferencial', 'Inyección epóxica y enlucido', NULL, false, '', 'ml', 'direct', 0.000, 0.000, 0.000, 4.500, 0.000, 100.00, 4.500, NULL, '', 'complete', 12500.00, false, 19.00, 56250.00, false, NULL, NULL, NULL, NULL, '2026-11-06 00:42:04.393299-03', 'b44b0c71-c807-43e5-91e3-12999ab526a6', '', 4.500, 100.00);
INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('bcc0af53-9085-4dfe-917d-b9c31c972b56', 'd0000000-0000-0000-0000-000000000003', 'PATIO E2E 749', 'Muro exterior', 'Grieta diagonal', '', 'Fisura producida por asentamiento diferencial', 'Inyección epóxica y enlucido', NULL, false, '', 'ml', 'direct', 0.000, 0.000, 0.000, 4.500, 0.000, 100.00, 4.500, NULL, '', 'complete', 12500.00, false, 19.00, 56250.00, false, NULL, NULL, NULL, NULL, '2026-11-06 07:59:51.791035-03', '063878ff-139b-4f22-b4fd-e30f27f3fb08', '', 4.500, 100.00);
INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('c98bdc2f-12b3-424c-a7b6-f47fd252f123', 'd0000000-0000-0000-0000-000000000002', 'PATIO E2E 620', 'Muro exterior', 'Grieta diagonal', '', 'Fisura producida por asentamiento diferencial', 'Inyección epóxica y enlucido', NULL, false, '', 'ml', 'direct', 0.000, 0.000, 0.000, 4.500, 0.000, 100.00, 4.500, NULL, '', 'complete', 12500.00, false, 19.00, 56250.00, false, NULL, NULL, NULL, NULL, '2026-11-06 09:19:25.674337-03', 'ef3a1a40-b656-4bee-97f5-748765a97693', '', 4.500, 100.00);
INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('9b5fe04b-d5be-4702-b0df-7875b899996c', 'd0000000-0000-0000-0000-000000000003', 'PATIO E2E 215', 'Muro exterior', 'Grieta diagonal', '', 'Fisura producida por asentamiento diferencial', 'Inyección epóxica y enlucido', NULL, false, '', 'ml', 'direct', 0.000, 0.000, 0.000, 4.500, 0.000, 100.00, 4.500, NULL, '', 'complete', 12500.00, false, 19.00, 56250.00, false, NULL, NULL, NULL, NULL, '2026-11-06 10:51:14.273912-03', '71080fc5-d0df-487f-b737-48be5a18bc6d', '', 4.500, 100.00);
INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('cdd6c709-8df4-4c2d-ae7c-8d9c0c688059', 'd0000000-0000-0000-0000-000000000002', 'PATIO E2E 578', 'Muro exterior', 'Grieta diagonal', '', 'Fisura producida por asentamiento diferencial', 'Inyección epóxica y enlucido', NULL, false, '', 'ml', 'direct', 0.000, 0.000, 0.000, 4.500, 0.000, 100.00, 4.500, NULL, '', 'complete', 12500.00, false, 19.00, 56250.00, false, NULL, NULL, NULL, NULL, '2026-11-08 14:01:19.655892-03', '015187dd-d00b-4e61-bd7e-36cc2bf23ba6', '', 4.500, 100.00);
INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('2db91722-65a3-4b20-8e92-42299032c7b2', 'd0000000-0000-0000-0000-000000000003', 'PATIO E2E 522', 'Muro exterior', 'Grieta diagonal', '', 'Fisura producida por asentamiento diferencial', 'Inyección epóxica y enlucido', NULL, false, '', 'ml', 'direct', 0.000, 0.000, 0.000, 4.500, 0.000, 100.00, 4.500, NULL, '', 'complete', 12500.00, false, 19.00, 56250.00, false, NULL, NULL, NULL, NULL, '2026-11-18 21:03:41.577505-03', '0cf428c4-619c-46b9-b011-c465dcd358b4', '', 4.500, 100.00);
INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('d4e02b2c-b0b5-4b97-a9a3-f9d014f9785d', 'd0000000-0000-0000-0000-000000000002', 'PATIO E2E 280', 'Muro exterior', 'Grieta diagonal', '', 'Fisura producida por asentamiento diferencial', 'Inyección epóxica y enlucido', NULL, false, '', 'ml', 'direct', 0.000, 0.000, 0.000, 4.500, 0.000, 100.00, 4.500, NULL, '', 'complete', 12500.00, false, 19.00, 56250.00, false, NULL, NULL, NULL, NULL, '2026-11-18 21:32:39.338563-03', 'e7298de5-0f73-4c9f-b01e-6321b1df058d', '', 4.500, 100.00);
INSERT INTO public.partida_dano (id, expediente_id, sector, elemento, dano_tipo, material_existente, descripcion_dano, reparacion_propuesta, proceso_id, es_estructural, referencia_estructural, unidad_id, metodo_calculo, largo, ancho, alto, cantidad_directa, descuento, porcentaje_afectado, cantidad_medida, cantidad_reparacion, justificacion_reparacion, modo_precio, precio_unitario_neto, incluye_iva, tasa_iva, subtotal_neto, precio_verificado, fuente_precio, proveedor_precio, fecha_cotizacion, region_cotizacion, created_at, sector_id, materialidad, cantidad_afectada, porcentaje_intervencion) VALUES ('2dfd6f0b-be7f-403b-bc59-0262bfc865a5', 'd0000000-0000-0000-0000-000000000003', 'PATIO E2E 59', 'Muro exterior', 'Grieta diagonal', '', 'Fisura producida por asentamiento diferencial', 'Inyección epóxica y enlucido', NULL, false, '', 'ml', 'direct', 0.000, 0.000, 0.000, 4.500, 0.000, 100.00, 4.500, NULL, '', 'complete', 12500.00, false, 19.00, 56250.00, false, NULL, NULL, NULL, NULL, '2026-11-21 21:45:42.169978-03', 'd2cea00e-dc29-4073-b315-7fb06b12d502', '', 4.500, 100.00);


--
-- Data for Name: partida_presupuesto_ajuste; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('203110d2-6a53-4293-a361-af20557cfe12', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '063878ff-139b-4f22-b4fd-e30f27f3fb08', 'PATIO E2E 749', 'bcc0af53-9085-4dfe-917d-b9c31c972b56', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.844894-03', '2026-11-21 23:23:13.844894-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('dabb8048-1a1c-434b-8df3-fddc81ec7441', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '063878ff-139b-4f22-b4fd-e30f27f3fb08', 'PATIO E2E 749', 'bcc0af53-9085-4dfe-917d-b9c31c972b56', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.847986-03', '2026-11-21 23:23:13.847986-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('81a14c9a-9fb2-4e48-ab6d-52249d9da5b0', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '063878ff-139b-4f22-b4fd-e30f27f3fb08', 'PATIO E2E 749', 'bcc0af53-9085-4dfe-917d-b9c31c972b56', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.849595-03', '2026-11-21 23:23:13.849595-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('d2d5f76f-c728-4798-8d2f-aeb983ec0ea8', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '063878ff-139b-4f22-b4fd-e30f27f3fb08', 'PATIO E2E 749', 'bcc0af53-9085-4dfe-917d-b9c31c972b56', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.850988-03', '2026-11-21 23:23:13.850988-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('919e23b9-5d67-4c86-b4df-5e23e1e55036', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '063878ff-139b-4f22-b4fd-e30f27f3fb08', 'PATIO E2E 749', 'bcc0af53-9085-4dfe-917d-b9c31c972b56', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.852779-03', '2026-11-21 23:23:13.852779-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('a26f4550-2bbe-405f-8b5c-5438d001f314', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '71080fc5-d0df-487f-b737-48be5a18bc6d', 'PATIO E2E 215', '9b5fe04b-d5be-4702-b0df-7875b899996c', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.854437-03', '2026-11-21 23:23:13.854437-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('91acfbc0-5c2c-4e63-a178-5121a658fe70', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '71080fc5-d0df-487f-b737-48be5a18bc6d', 'PATIO E2E 215', '9b5fe04b-d5be-4702-b0df-7875b899996c', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.855889-03', '2026-11-21 23:23:13.855889-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('d6846c3d-2f69-4d98-9a04-0cd2181cc6d4', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '71080fc5-d0df-487f-b737-48be5a18bc6d', 'PATIO E2E 215', '9b5fe04b-d5be-4702-b0df-7875b899996c', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.857056-03', '2026-11-21 23:23:13.857056-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('3da55d41-e1c1-4aee-895b-d469df57a062', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '71080fc5-d0df-487f-b737-48be5a18bc6d', 'PATIO E2E 215', '9b5fe04b-d5be-4702-b0df-7875b899996c', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.858185-03', '2026-11-21 23:23:13.858185-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('60942143-871d-4ab3-b66a-3a69e14d484a', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '71080fc5-d0df-487f-b737-48be5a18bc6d', 'PATIO E2E 215', '9b5fe04b-d5be-4702-b0df-7875b899996c', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.859836-03', '2026-11-21 23:23:13.859836-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('8356e3fa-3663-4395-ba5c-115e20b34426', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '0cf428c4-619c-46b9-b011-c465dcd358b4', 'PATIO E2E 522', '2db91722-65a3-4b20-8e92-42299032c7b2', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.861135-03', '2026-11-21 23:23:13.861135-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('be0daad2-3af8-4f69-a2c9-54c4583cde3f', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '0cf428c4-619c-46b9-b011-c465dcd358b4', 'PATIO E2E 522', '2db91722-65a3-4b20-8e92-42299032c7b2', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.862198-03', '2026-11-21 23:23:13.862198-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('caf2bd7a-db48-4102-9de5-4670708174e7', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '0cf428c4-619c-46b9-b011-c465dcd358b4', 'PATIO E2E 522', '2db91722-65a3-4b20-8e92-42299032c7b2', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.863215-03', '2026-11-21 23:23:13.863215-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('04399feb-fb9e-4a4b-8948-8cf2a49c7bb2', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '0cf428c4-619c-46b9-b011-c465dcd358b4', 'PATIO E2E 522', '2db91722-65a3-4b20-8e92-42299032c7b2', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.864199-03', '2026-11-21 23:23:13.864199-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('942c755e-2c5f-45d9-9f15-a329a623f813', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', '0cf428c4-619c-46b9-b011-c465dcd358b4', 'PATIO E2E 522', '2db91722-65a3-4b20-8e92-42299032c7b2', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.865521-03', '2026-11-21 23:23:13.865521-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('0f9898e5-a388-45b1-a149-e012e49e069b', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', 'd2cea00e-dc29-4073-b315-7fb06b12d502', 'PATIO E2E 59', '2dfd6f0b-be7f-403b-bc59-0262bfc865a5', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.867197-03', '2026-11-21 23:23:13.867197-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('5185febc-5d2d-45cc-a0c0-28724d21fb56', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', 'd2cea00e-dc29-4073-b315-7fb06b12d502', 'PATIO E2E 59', '2dfd6f0b-be7f-403b-bc59-0262bfc865a5', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.86894-03', '2026-11-21 23:23:13.86894-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('6e4282fe-2a8c-49a5-b75b-c8266211f12f', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', 'd2cea00e-dc29-4073-b315-7fb06b12d502', 'PATIO E2E 59', '2dfd6f0b-be7f-403b-bc59-0262bfc865a5', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.870416-03', '2026-11-21 23:23:13.870416-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('ed9f35c8-4e34-4433-9ca9-6f16d565710d', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', 'd2cea00e-dc29-4073-b315-7fb06b12d502', 'PATIO E2E 59', '2dfd6f0b-be7f-403b-bc59-0262bfc865a5', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.871529-03', '2026-11-21 23:23:13.871529-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('09858d6d-1786-4260-86bf-0d62967141c3', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', 'd2cea00e-dc29-4073-b315-7fb06b12d502', 'PATIO E2E 59', '2dfd6f0b-be7f-403b-bc59-0262bfc865a5', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.873049-03', '2026-11-21 23:23:13.873049-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('783bde97-97e8-4c6c-9b68-62c3b2a32787', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', NULL, 'GASTOS GENERALES', NULL, 'Gastos operativos globales del proyecto', NULL, 'GG-FLETE', 'Flete', 'Gastos Generales', 'gl', 1.000, 1.000, 'Global por faena', 1810.00, 1810.00, true, 100, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.874714-03', '2026-11-21 23:23:13.874714-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('6c109e84-1eae-4926-be25-81d4aa9aac31', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', NULL, 'GASTOS GENERALES', NULL, 'Gastos operativos globales del proyecto', NULL, 'GG-ESCOMB', 'Retiro de escombros', 'Gastos Generales', 'gl', 1.000, 1.000, 'Global por faena', 1810.00, 1810.00, true, 101, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.875923-03', '2026-11-21 23:23:13.875923-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('8943bc01-c6f4-4143-a5ef-0415de4d9ebc', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', NULL, 'GASTOS GENERALES', NULL, 'Gastos operativos globales del proyecto', NULL, 'GG-ASEO', 'Aseo y entrega final', 'Gastos Generales', 'gl', 1.000, 1.000, 'Global por faena', 1810.00, 1810.00, true, 102, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.876988-03', '2026-11-21 23:23:13.876988-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('c97b3d37-6e0b-42c1-b21b-83b026402cbd', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', NULL, 'GASTOS GENERALES', NULL, 'Gastos operativos globales del proyecto', NULL, 'GG-PROT', 'Protección de área de trabajo', 'Gastos Generales', 'gl', 1.000, 1.000, 'Global por faena', 1810.00, 1810.00, true, 103, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.877958-03', '2026-11-21 23:23:13.877958-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('dcc0d89b-7311-4eaa-b089-2f2c4d11151f', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', NULL, 'LIVING COMEDOR', NULL, 'Fisura diagonal en tabique', NULL, NULL, 'Reparación de fisura', 'Terminaciones', 'ml', 4.500, 5.000, 'Fisura diagonal en tabique', 15000.00, 75000.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-21 23:23:13.885476-03', '2026-11-21 23:23:13.892938-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('24fa52b6-30d2-4ac6-b32a-31905bc14b4e', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', NULL, 'LIVING COMEDOR', NULL, 'Fisura diagonal en tabique', NULL, NULL, 'Reparación de fisura', 'Terminaciones', 'ml', 4.500, 5.000, 'Fisura diagonal en tabique', 15000.00, 75000.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 00:41:22.293296-03', '2026-11-22 00:41:22.331459-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('d8ebfcd8-c65e-4529-aba9-990676fdf8b1', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000001', 'Muro - Preparación de superficie (L 2.4 · A 1.3 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 17.760, 17.760, 'Calculada a partir de dimensiones periciales', 1000.00, 17760.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.300634-03', '2026-11-22 15:05:10.300634-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('d92c53ea-3ec4-4870-98f3-2f7abe7032f5', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000001', 'Muro - Preparación de superficie (L 2.4 · A 1.3 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 12.300, 12.300, 'Calculada a partir de dimensiones periciales', 1000.00, 12300.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.310248-03', '2026-11-22 15:05:10.310248-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('dcd3cda1-0505-43e5-bf5b-ba276e6fc92d', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000001', 'Muro - Preparación de superficie (L 2.4 · A 1.3 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 12.300, 12.300, 'Calculada a partir de dimensiones periciales', 1000.00, 12300.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.312318-03', '2026-11-22 15:05:10.312318-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('ffeaa4a8-2655-4f4a-a20d-c5c815712e73', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000001', 'Muro - Preparación de superficie (L 2.4 · A 1.3 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 17.760, 17.760, 'Calculada a partir de dimensiones periciales', 1000.00, 17760.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.314631-03', '2026-11-22 15:05:10.314631-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('a92eef17-6f4c-47c1-bb83-4223b573a2ec', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000001', 'Muro - Preparación de superficie (L 2.4 · A 1.3 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 12.300, 12.300, 'Calculada a partir de dimensiones periciales', 1000.00, 12300.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.316363-03', '2026-11-22 15:05:10.316363-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('32e85885-bac0-46f5-b304-2b7eed44a62b', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000002', 'Muro - Provi. y aplicación de empaste (L 0 · A 0 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.318609-03', '2026-11-22 15:05:10.318609-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('b94817d6-1bf1-43d9-8962-4de71af2f7f5', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000002', 'Muro - Provi. y aplicación de empaste (L 0 · A 0 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.32033-03', '2026-11-22 15:05:10.32033-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('77c4b05b-f7ef-4079-bcd3-08bec624ba8d', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000002', 'Muro - Provi. y aplicación de empaste (L 0 · A 0 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.321892-03', '2026-11-22 15:05:10.321892-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('06b8bc30-d6fe-401f-b02a-51b54c68b121', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000002', 'Muro - Provi. y aplicación de empaste (L 0 · A 0 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.323243-03', '2026-11-22 15:05:10.323243-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('f336cd72-ed54-40c0-a45b-c1c703740a61', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000002', 'Muro - Provi. y aplicación de empaste (L 0 · A 0 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.324582-03', '2026-11-22 15:05:10.324582-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('eb4e0b16-e62f-488e-bc7f-ee3235c5c664', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000003', 'Muro - Reparación de Fisura (L 0 · A 0 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.326322-03', '2026-11-22 15:05:10.326322-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('87623f1b-1ef2-48a9-91cc-d3f3cd2e259f', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000003', 'Muro - Reparación de Fisura (L 0 · A 0 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.32796-03', '2026-11-22 15:05:10.32796-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('7692ddb1-1d36-4c6f-a143-4773748d2b39', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000003', 'Muro - Reparación de Fisura (L 0 · A 0 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.329459-03', '2026-11-22 15:05:10.329459-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('8a79fd66-17e8-4064-adf9-ce44fd1cb397', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000003', 'Muro - Reparación de Fisura (L 0 · A 0 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.330609-03', '2026-11-22 15:05:10.330609-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('62b88afc-1f1f-4526-ad7f-5f5c02369f62', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000003', 'Muro - Reparación de Fisura (L 0 · A 0 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.331815-03', '2026-11-22 15:05:10.331815-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('1e8f323c-1529-4a21-a604-cca2962c7085', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000004', 'Muro - Provi. y aplicación de pintura dos manos (L 2.4 · A 1.3 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 17.760, 17.760, 'Calculada a partir de dimensiones periciales', 1000.00, 17760.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.333115-03', '2026-11-22 15:05:10.333115-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('be4e5b0a-41fd-4f1b-b3e6-020eb20d06e9', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000004', 'Muro - Provi. y aplicación de pintura dos manos (L 2.4 · A 1.3 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 13.500, 13.500, 'Calculada a partir de dimensiones periciales', 1000.00, 13500.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.334269-03', '2026-11-22 15:05:10.334269-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('2044b7fe-b710-4e00-800d-309dc25e835c', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000004', 'Muro - Provi. y aplicación de pintura dos manos (L 2.4 · A 1.3 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 13.500, 13.500, 'Calculada a partir de dimensiones periciales', 1000.00, 13500.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.335614-03', '2026-11-22 15:05:10.335614-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('944f688e-7741-43c5-8e3d-2fdd56e111da', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000004', 'Muro - Provi. y aplicación de pintura dos manos (L 2.4 · A 1.3 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 17.760, 17.760, 'Calculada a partir de dimensiones periciales', 1000.00, 17760.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.338048-03', '2026-11-22 15:05:10.338048-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('0a85a94d-a70a-4f59-a691-e5ed5f3e9c66', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000004', 'Muro - Provi. y aplicación de pintura dos manos (L 2.4 · A 1.3 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 13.500, 13.500, 'Calculada a partir de dimensiones periciales', 1000.00, 13500.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.339658-03', '2026-11-22 15:05:10.339658-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('e465164a-c51f-4324-8d6f-fb9b1123e697', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000005', 'Muro - Provi. y aplicación de martelina (L 0 · A 0 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.342181-03', '2026-11-22 15:05:10.342181-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('14580d1e-635b-4af5-a523-aec78e60b851', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000005', 'Muro - Provi. y aplicación de martelina (L 0 · A 0 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.343664-03', '2026-11-22 15:05:10.343664-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('2c239ad6-0b81-4376-b39a-1eee95cf4653', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000005', 'Muro - Provi. y aplicación de martelina (L 0 · A 0 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.344914-03', '2026-11-22 15:05:10.344914-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('2ccf5d2e-74a2-45ae-b4a4-0d85a5bb7176', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000005', 'Muro - Provi. y aplicación de martelina (L 0 · A 0 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.346311-03', '2026-11-22 15:05:10.346311-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('8782b623-194f-4302-93c2-b323ff0df32e', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'e0000000-0000-0000-0000-000000000005', 'Muro - Provi. y aplicación de martelina (L 0 · A 0 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 1.500, 1.500, 'Calculada a partir de dimensiones periciales', 1000.00, 1500.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.347712-03', '2026-11-22 15:05:10.347712-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('8702b22c-a017-4a19-b9c6-0a73eff60481', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', NULL, 'GASTOS GENERALES', NULL, 'Gastos operativos globales del proyecto', NULL, 'GG-FLETE', 'Flete', 'Gastos Generales', 'gl', 1.000, 1.000, 'Global por faena', 1810.00, 1810.00, true, 100, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.349186-03', '2026-11-22 15:05:10.349186-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('24daa826-147e-4ae1-b0f7-0df1d6af6cb1', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', NULL, 'GASTOS GENERALES', NULL, 'Gastos operativos globales del proyecto', NULL, 'GG-ESCOMB', 'Retiro de escombros', 'Gastos Generales', 'gl', 1.000, 1.000, 'Global por faena', 1810.00, 1810.00, true, 101, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.350452-03', '2026-11-22 15:05:10.350452-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('f1169d1d-7362-4607-a57e-1caeaa895f72', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', NULL, 'GASTOS GENERALES', NULL, 'Gastos operativos globales del proyecto', NULL, 'GG-ASEO', 'Aseo y entrega final', 'Gastos Generales', 'gl', 1.000, 1.000, 'Global por faena', 1810.00, 1810.00, true, 102, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.351635-03', '2026-11-22 15:05:10.351635-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('6bf7c039-f630-4376-addc-c5d899e63b64', 'afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', NULL, 'GASTOS GENERALES', NULL, 'Gastos operativos globales del proyecto', NULL, 'GG-PROT', 'Protección de área de trabajo', 'Gastos Generales', 'gl', 1.000, 1.000, 'Global por faena', 1810.00, 1810.00, true, 103, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.3535-03', '2026-11-22 15:05:10.3535-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('f8d0e1d7-7088-4b6a-af39-a8138c4e8b82', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'b44b0c71-c807-43e5-91e3-12999ab526a6', 'PATIO E2E 328', '6c9e86d8-10a4-4061-a8a4-206031db3f8a', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.362511-03', '2026-11-22 15:05:10.362511-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('e4368e7c-ccb8-4db2-8bf8-9cfcc636f7d7', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'b44b0c71-c807-43e5-91e3-12999ab526a6', 'PATIO E2E 328', '6c9e86d8-10a4-4061-a8a4-206031db3f8a', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.364417-03', '2026-11-22 15:05:10.364417-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('77725709-c82f-4f6d-8f54-6185b76a909e', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'b44b0c71-c807-43e5-91e3-12999ab526a6', 'PATIO E2E 328', '6c9e86d8-10a4-4061-a8a4-206031db3f8a', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.365672-03', '2026-11-22 15:05:10.365672-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('c172632c-132d-48bf-94b4-512d2db91f97', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'b44b0c71-c807-43e5-91e3-12999ab526a6', 'PATIO E2E 328', '6c9e86d8-10a4-4061-a8a4-206031db3f8a', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.36712-03', '2026-11-22 15:05:10.36712-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('f92bc191-0600-4c1c-b105-dc71fea0509c', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'b44b0c71-c807-43e5-91e3-12999ab526a6', 'PATIO E2E 328', '6c9e86d8-10a4-4061-a8a4-206031db3f8a', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.368368-03', '2026-11-22 15:05:10.368368-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('ec4236a5-538e-4ed7-b010-cda656c2f5e2', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'ef3a1a40-b656-4bee-97f5-748765a97693', 'PATIO E2E 620', 'c98bdc2f-12b3-424c-a7b6-f47fd252f123', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.36961-03', '2026-11-22 15:05:10.36961-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('e5813c5b-fc3d-4438-90d6-d0d4523e9116', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'ef3a1a40-b656-4bee-97f5-748765a97693', 'PATIO E2E 620', 'c98bdc2f-12b3-424c-a7b6-f47fd252f123', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.370993-03', '2026-11-22 15:05:10.370993-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('98cc38d8-c08e-472b-8bdf-6156f3c7db60', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'ef3a1a40-b656-4bee-97f5-748765a97693', 'PATIO E2E 620', 'c98bdc2f-12b3-424c-a7b6-f47fd252f123', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.372223-03', '2026-11-22 15:05:10.372223-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('76e95cc4-3020-40ee-9c73-aef55e72b4c3', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'ef3a1a40-b656-4bee-97f5-748765a97693', 'PATIO E2E 620', 'c98bdc2f-12b3-424c-a7b6-f47fd252f123', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.373502-03', '2026-11-22 15:05:10.373502-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('d2f74887-a26d-4bab-b889-6795fcfd929f', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'ef3a1a40-b656-4bee-97f5-748765a97693', 'PATIO E2E 620', 'c98bdc2f-12b3-424c-a7b6-f47fd252f123', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.374785-03', '2026-11-22 15:05:10.374785-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('304adfbb-0784-4a65-8c74-5f1d399497fa', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', '015187dd-d00b-4e61-bd7e-36cc2bf23ba6', 'PATIO E2E 578', 'cdd6c709-8df4-4c2d-ae7c-8d9c0c688059', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.376005-03', '2026-11-22 15:05:10.376005-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('22088395-6db4-4ba8-951d-5ed5e3c59a2a', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', '015187dd-d00b-4e61-bd7e-36cc2bf23ba6', 'PATIO E2E 578', 'cdd6c709-8df4-4c2d-ae7c-8d9c0c688059', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.377509-03', '2026-11-22 15:05:10.377509-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('488b3627-7d37-4aaa-b405-1b08ad10f0a8', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', '015187dd-d00b-4e61-bd7e-36cc2bf23ba6', 'PATIO E2E 578', 'cdd6c709-8df4-4c2d-ae7c-8d9c0c688059', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.378756-03', '2026-11-22 15:05:10.378756-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('18742ab9-a9a5-4f65-88bd-ecdce49b6df7', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', '015187dd-d00b-4e61-bd7e-36cc2bf23ba6', 'PATIO E2E 578', 'cdd6c709-8df4-4c2d-ae7c-8d9c0c688059', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.380027-03', '2026-11-22 15:05:10.380027-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('3de3e2f6-6fc2-4707-83e1-c1af6b676f3b', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', '015187dd-d00b-4e61-bd7e-36cc2bf23ba6', 'PATIO E2E 578', 'cdd6c709-8df4-4c2d-ae7c-8d9c0c688059', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.381655-03', '2026-11-22 15:05:10.381655-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('58ca0cf9-fa66-437a-b150-8c86ffbd4e29', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'e7298de5-0f73-4c9f-b01e-6321b1df058d', 'PATIO E2E 280', 'd4e02b2c-b0b5-4b97-a9a3-f9d014f9785d', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PREP-SUP', 'Preparación de superficie', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.383027-03', '2026-11-22 15:05:10.383027-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('5ff985ba-9769-4854-9b54-4cbcc037fd43', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'e7298de5-0f73-4c9f-b01e-6321b1df058d', 'PATIO E2E 280', 'd4e02b2c-b0b5-4b97-a9a3-f9d014f9785d', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'EMP-ML', 'Provisión y aplicación de empaste', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 2, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.384662-03', '2026-11-22 15:05:10.384662-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('124e0673-11fd-4f96-8baa-88fc2f9ac01a', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'e7298de5-0f73-4c9f-b01e-6321b1df058d', 'PATIO E2E 280', 'd4e02b2c-b0b5-4b97-a9a3-f9d014f9785d', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'REP-FIS', 'Reparación de fisura', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 3, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.385845-03', '2026-11-22 15:05:10.385845-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('cb71969a-ed2f-4c8a-b524-fa13d896158f', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'e7298de5-0f73-4c9f-b01e-6321b1df058d', 'PATIO E2E 280', 'd4e02b2c-b0b5-4b97-a9a3-f9d014f9785d', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'PINT-2M', 'Provisión y aplicación de pintura dos manos', 'Terminaciones', 'm²', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 4, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.387068-03', '2026-11-22 15:05:10.387068-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('4735a6d9-cc04-4190-9934-32f6c7b868c7', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'e7298de5-0f73-4c9f-b01e-6321b1df058d', 'PATIO E2E 280', 'd4e02b2c-b0b5-4b97-a9a3-f9d014f9785d', 'Muro exterior - Inyección epóxica y enlucido (L 0 · A 0 m)', NULL, 'MART-ML', 'Provisión y aplicación de martelina', 'Terminaciones', 'ml', 4.500, 4.500, 'Calculada a partir de dimensiones periciales', 1000.00, 4500.00, false, 5, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.388739-03', '2026-11-22 15:05:10.388739-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('53108221-179f-47cc-ba78-059af9d6e5e7', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', NULL, 'GASTOS GENERALES', NULL, 'Gastos operativos globales del proyecto', NULL, 'GG-FLETE', 'Flete', 'Gastos Generales', 'gl', 1.000, 1.000, 'Global por faena', 1810.00, 1810.00, true, 100, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.390162-03', '2026-11-22 15:05:10.390162-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('e382dab7-28cf-4db5-88f6-089d4e6fce80', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', NULL, 'GASTOS GENERALES', NULL, 'Gastos operativos globales del proyecto', NULL, 'GG-ESCOMB', 'Retiro de escombros', 'Gastos Generales', 'gl', 1.000, 1.000, 'Global por faena', 1810.00, 1810.00, true, 101, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.391797-03', '2026-11-22 15:05:10.391797-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('3dedd421-af0a-4c92-9db8-4f44f1c23930', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', NULL, 'GASTOS GENERALES', NULL, 'Gastos operativos globales del proyecto', NULL, 'GG-ASEO', 'Aseo y entrega final', 'Gastos Generales', 'gl', 1.000, 1.000, 'Global por faena', 1810.00, 1810.00, true, 102, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.393056-03', '2026-11-22 15:05:10.393056-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('e1dedf92-e46e-4374-a743-3162d7879b55', '18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', NULL, 'GASTOS GENERALES', NULL, 'Gastos operativos globales del proyecto', NULL, 'GG-PROT', 'Protección de área de trabajo', 'Gastos Generales', 'gl', 1.000, 1.000, 'Global por faena', 1810.00, 1810.00, true, 103, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:05:10.394405-03', '2026-11-22 15:05:10.394405-03');
INSERT INTO public.partida_presupuesto_ajuste (id, presupuesto_id, expediente_id, sector_id, sector_nombre, dano_id, dano_descripcion, proceso_id, proceso_codigo, proceso_nombre, categoria, unidad_id, cantidad_base, cantidad, justificacion_cantidad, valor_unitario, subtotal, es_gasto_general, orden, usuario_id, created_at, updated_at) VALUES ('1923ed2d-884e-42ae-bc83-dee619cb340e', '1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', NULL, 'LIVING COMEDOR', NULL, 'Fisura diagonal en tabique', NULL, NULL, 'Reparación de fisura', 'Terminaciones', 'ml', 4.500, 5.000, 'Fisura diagonal en tabique', 15000.00, 75000.00, false, 1, 'a0000000-0000-0000-0000-000000000020', '2026-11-22 15:18:30.005038-03', '2026-11-22 15:18:30.019503-03');


--
-- Data for Name: presupuesto_ajuste; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.presupuesto_ajuste (id, expediente_id, ajustador_id, version, estado, costo_directo, porcentaje_gg, monto_gg, neto, porcentaje_iva, monto_iva, total, observaciones_ajustador, observaciones_revision, aprobado_por, fecha_aprobacion, fecha_envio_revision, created_at, updated_at) VALUES ('afbd71ab-040d-4d18-8b09-59c8f03185d5', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000020', 1, 'borrador', 178180.00, 25.00, 44545.00, 222725.00, 19.00, 42318.00, 265043.00, NULL, NULL, NULL, NULL, NULL, '2026-11-22 15:05:10.254256-03', '2026-11-22 15:05:10.354986-03');
INSERT INTO public.presupuesto_ajuste (id, expediente_id, ajustador_id, version, estado, costo_directo, porcentaje_gg, monto_gg, neto, porcentaje_iva, monto_iva, total, observaciones_ajustador, observaciones_revision, aprobado_por, fecha_aprobacion, fecha_envio_revision, created_at, updated_at) VALUES ('18773f35-8899-40ab-8adb-1be3fb0c63f8', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000020', 1, 'borrador', 97240.00, 25.00, 24310.00, 121550.00, 19.00, 23095.00, 144645.00, NULL, NULL, NULL, NULL, NULL, '2026-11-22 15:05:10.360241-03', '2026-11-22 15:05:10.396048-03');
INSERT INTO public.presupuesto_ajuste (id, expediente_id, ajustador_id, version, estado, costo_directo, porcentaje_gg, monto_gg, neto, porcentaje_iva, monto_iva, total, observaciones_ajustador, observaciones_revision, aprobado_por, fecha_aprobacion, fecha_envio_revision, created_at, updated_at) VALUES ('1963beac-f836-477d-8878-9acc913270ee', 'd0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000020', 1, 'aprobado', 322240.00, 25.00, 80560.00, 402800.00, 19.00, 76532.00, 479332.00, NULL, 'Revisar metraje de pintura en paño living y justificar flete.', 'a0000000-0000-0000-0000-000000000002', '2026-11-22 15:18:30.044284-03', '2026-11-22 15:18:30.04109-03', '2026-11-21 23:23:13.838478-03', '2026-11-22 15:18:30.044284-03');


--
-- Data for Name: proceso_liquidador; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.proceso_liquidador (id, catalogo_id, codigo, nombre, categoria, unidad, precio_unitario, incluye_iva, tasa_iva, fuente, activo) VALUES ('8d61c66c-83ee-4607-8b83-dfa625205f05', 'c0000000-0000-0000-0000-000000000001', 'PRO-PREP', 'Preparación de superficie', 'Pintura', 'm²', 1000.00, false, 19.00, NULL, true);
INSERT INTO public.proceso_liquidador (id, catalogo_id, codigo, nombre, categoria, unidad, precio_unitario, incluye_iva, tasa_iva, fuente, activo) VALUES ('3ee5b259-0189-4dfa-8b2c-22ea79c5020f', 'c0000000-0000-0000-0000-000000000001', 'PRO-EMP', 'Provi. y aplicación de empaste', 'Pintura', 'ml', 1000.00, false, 19.00, NULL, true);
INSERT INTO public.proceso_liquidador (id, catalogo_id, codigo, nombre, categoria, unidad, precio_unitario, incluye_iva, tasa_iva, fuente, activo) VALUES ('54bd91e5-3f83-4fa4-abda-f23e50a27592', 'c0000000-0000-0000-0000-000000000001', 'PRO-FIS', 'Reparación de Fisura', 'Estructuras', 'ml', 1000.00, false, 19.00, NULL, true);
INSERT INTO public.proceso_liquidador (id, catalogo_id, codigo, nombre, categoria, unidad, precio_unitario, incluye_iva, tasa_iva, fuente, activo) VALUES ('5d2ea671-7a16-4043-b746-92a5ab30a664', 'c0000000-0000-0000-0000-000000000001', 'PRO-PINT', 'Provi. y aplicación de pintura dos manos', 'Pintura', 'm²', 1000.00, false, 19.00, NULL, true);
INSERT INTO public.proceso_liquidador (id, catalogo_id, codigo, nombre, categoria, unidad, precio_unitario, incluye_iva, tasa_iva, fuente, activo) VALUES ('89ae98ce-b5f3-43a8-be40-61e6b18aa534', 'c0000000-0000-0000-0000-000000000001', 'PRO-MART', 'Provi. y aplicación de martelina', 'Terminaciones', 'ml', 1000.00, false, 19.00, NULL, true);


--
-- Data for Name: progress_updates; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: rate_limits; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: recurso_apu; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: sector_expediente; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'Baño principal en primer piso', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-05 22:17:47.11954-03', '2026-11-05 22:17:47.11954-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'LIVING COMEDOR', 'Área común principal acceso', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-05 22:17:47.11954-03', '2026-11-05 22:17:47.11954-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'COCINA', 'Cocina y logia posterior', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-05 22:17:47.11954-03', '2026-11-05 22:17:47.11954-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'DORMITORIO 1', 'Dormitorio secundario poniente', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-05 22:17:47.11954-03', '2026-11-05 22:17:47.11954-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('b44b0c71-c807-43e5-91e3-12999ab526a6', 'd0000000-0000-0000-0000-000000000002', 'PATIO E2E 328', 'Sector creado en prueba E2E automatizada', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-06 00:42:04.334881-03', '2026-11-06 00:42:04.334881-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('063878ff-139b-4f22-b4fd-e30f27f3fb08', 'd0000000-0000-0000-0000-000000000003', 'PATIO E2E 749', 'Sector creado en prueba E2E automatizada', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-06 07:59:51.757472-03', '2026-11-06 07:59:51.757472-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('ef3a1a40-b656-4bee-97f5-748765a97693', 'd0000000-0000-0000-0000-000000000002', 'PATIO E2E 620', 'Sector creado en prueba E2E automatizada', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-06 09:19:25.631357-03', '2026-11-06 09:19:25.631357-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('7a1c2d8b-38c6-4809-9acd-e25176cda631', 'd0000000-0000-0000-0000-000000000003', 'PATIO E2E 769', 'Sector creado en prueba E2E automatizada', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-06 10:50:40.777726-03', '2026-11-06 10:50:40.777726-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('71080fc5-d0df-487f-b737-48be5a18bc6d', 'd0000000-0000-0000-0000-000000000003', 'PATIO E2E 215', 'Sector creado en prueba E2E automatizada', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-06 10:51:14.224846-03', '2026-11-06 10:51:14.224846-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('015187dd-d00b-4e61-bd7e-36cc2bf23ba6', 'd0000000-0000-0000-0000-000000000002', 'PATIO E2E 578', 'Sector creado en prueba E2E automatizada', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-08 14:01:19.584694-03', '2026-11-08 14:01:19.584694-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('ce2845c5-ba8e-4a00-9858-14ef42a9cf4b', 'd0000000-0000-0000-0000-000000000003', 'BAÑO NUEVO', '', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-18 20:50:41.905956-03', '2026-11-18 20:50:41.905956-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('0cf428c4-619c-46b9-b011-c465dcd358b4', 'd0000000-0000-0000-0000-000000000003', 'PATIO E2E 522', 'Sector creado en prueba E2E automatizada', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-18 21:03:41.530456-03', '2026-11-18 21:03:41.530456-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('e7298de5-0f73-4c9f-b01e-6321b1df058d', 'd0000000-0000-0000-0000-000000000002', 'PATIO E2E 280', 'Sector creado en prueba E2E automatizada', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-18 21:32:39.28895-03', '2026-11-18 21:32:39.28895-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('6a797350-dee3-40fd-b8b6-6dac683a484a', 'd0000000-0000-0000-0000-000000000003', 'PRUEBA', '', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-18 22:07:02.608069-03', '2026-11-18 22:07:02.608069-03');
INSERT INTO public.sector_expediente (id, expediente_id, nombre, descripcion, estado, usuario_id, created_at, updated_at) VALUES ('d2cea00e-dc29-4073-b315-7fb06b12d502', 'd0000000-0000-0000-0000-000000000003', 'PATIO E2E 59', 'Sector creado en prueba E2E automatizada', 'activo', 'a0000000-0000-0000-0000-000000000001', '2026-11-21 21:45:42.071914-03', '2026-11-21 21:45:42.071914-03');


--
-- Data for Name: unidad_medida; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.unidad_medida (id, etiqueta, dimension, escala, activo) VALUES ('m²', 'm²', 'area', 1.0000, true);
INSERT INTO public.unidad_medida (id, etiqueta, dimension, escala, activo) VALUES ('ml', 'ml', 'length', 1.0000, true);
INSERT INTO public.unidad_medida (id, etiqueta, dimension, escala, activo) VALUES ('m³', 'm³', 'volume', 1.0000, true);
INSERT INTO public.unidad_medida (id, etiqueta, dimension, escala, activo) VALUES ('un', 'un', 'count', 1.0000, true);
INSERT INTO public.unidad_medida (id, etiqueta, dimension, escala, activo) VALUES ('gl', 'gl', 'direct', 1.0000, true);
INSERT INTO public.unidad_medida (id, etiqueta, dimension, escala, activo) VALUES ('kg', 'kg', 'direct', 1.0000, true);
INSERT INTO public.unidad_medida (id, etiqueta, dimension, escala, activo) VALUES ('L', 'L', 'direct', 1.0000, true);
INSERT INTO public.unidad_medida (id, etiqueta, dimension, escala, activo) VALUES ('día', 'día', 'direct', 1.0000, true);


--
-- Data for Name: usuario; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.usuario (id, nombre, email, password_hash, rol, activo, created_at, updated_at, doble_perfil, roles) VALUES ('a0000000-0000-0000-0000-000000000010', 'Juan Pérez (Asegurado)', 'juan.perez@gmail.com', '$2a$10$1O2aIo8QtJyBg1C1fRrykektm6.pAO4fk1.wrZprViGoHQyexfYUi', 'cliente', true, '2026-11-08 00:18:40.33798-03', '2026-11-08 00:18:40.33798-03', false, '{cliente}');
INSERT INTO public.usuario (id, nombre, email, password_hash, rol, activo, created_at, updated_at, doble_perfil, roles) VALUES ('a0000000-0000-0000-0000-000000000011', 'María González (Asegurada)', 'maria.gonzalez@gmail.com', '$2a$10$1O2aIo8QtJyBg1C1fRrykektm6.pAO4fk1.wrZprViGoHQyexfYUi', 'cliente', true, '2026-11-08 00:18:40.375387-03', '2026-11-08 00:18:40.375387-03', false, '{cliente}');
INSERT INTO public.usuario (id, nombre, email, password_hash, rol, activo, created_at, updated_at, doble_perfil, roles) VALUES ('a0000000-0000-0000-0000-000000000012', 'Roberto Silva (Asegurado)', 'roberto.silva@empresa.cl', '$2a$10$1O2aIo8QtJyBg1C1fRrykektm6.pAO4fk1.wrZprViGoHQyexfYUi', 'cliente', true, '2026-11-08 00:18:40.381068-03', '2026-11-08 00:18:40.381068-03', false, '{cliente}');
INSERT INTO public.usuario (id, nombre, email, password_hash, rol, activo, created_at, updated_at, doble_perfil, roles) VALUES ('a0000000-0000-0000-0000-000000000000', 'Webmaster Lorens (Admin General)', 'webmaster@lorens.cl', '$2a$10$uXJDvaQNjpEaIXDMGoADe.fKoAnR8Rg2s1LDxyaXiYPJeEubjdFYW', 'admin', true, '2026-11-04 20:56:23.727204-03', '2026-11-04 20:56:23.727204-03', true, '{admin,inspector}');
INSERT INTO public.usuario (id, nombre, email, password_hash, rol, activo, created_at, updated_at, doble_perfil, roles) VALUES ('a0000000-0000-0000-0000-000000000001', 'Pedro Pérez (Inspector)', 'inspector@lorens.cl', '$2a$10$xfVScSVmTtaZ6R/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC', 'inspector', true, '2026-11-04 20:56:23.727204-03', '2026-11-04 20:56:23.727204-03', false, '{inspector}');
INSERT INTO public.usuario (id, nombre, email, password_hash, rol, activo, created_at, updated_at, doble_perfil, roles) VALUES ('a0000000-0000-0000-0000-000000000002', 'Alejandro Vargas (Admin)', 'admin@lorens.cl', '$2a$10$xfVScSVmTtaZ6R/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC', 'admin', true, '2026-11-04 20:56:23.727204-03', '2026-11-04 20:56:23.727204-03', false, '{admin}');
INSERT INTO public.usuario (id, nombre, email, password_hash, rol, activo, created_at, updated_at, doble_perfil, roles) VALUES ('a0000000-0000-0000-0000-000000000020', 'Carlos Mendoza (Ajustador)', 'ajustador@lorens.cl', '$2a$10$JN05fFql1.zjiugQ1jGwYe0kSOAZxx7KQj8lBLOi5pSmEmpAt9Byy', 'ajustador', true, '2026-11-21 22:38:46.446027-03', '2026-11-21 22:38:46.446027-03', false, '{ajustador}');


--
-- Data for Name: version_informe; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: evidencia_eventos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.evidencia_eventos_id_seq', 29, true);


--
-- Name: admin_users admin_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_key UNIQUE (email);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: asignacion_ajustador asignacion_ajustador_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignacion_ajustador
    ADD CONSTRAINT asignacion_ajustador_pkey PRIMARY KEY (id);


--
-- Name: auditoria_log auditoria_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_log
    ADD CONSTRAINT auditoria_log_pkey PRIMARY KEY (id);


--
-- Name: carousel_slides carousel_slides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carousel_slides
    ADD CONSTRAINT carousel_slides_pkey PRIMARY KEY (id);


--
-- Name: catalogo_liquidador catalogo_liquidador_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_liquidador
    ADD CONSTRAINT catalogo_liquidador_pkey PRIMARY KEY (id);


--
-- Name: catalogo_proceso_constructivo catalogo_proceso_constructivo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_proceso_constructivo
    ADD CONSTRAINT catalogo_proceso_constructivo_codigo_key UNIQUE (codigo);


--
-- Name: catalogo_proceso_constructivo catalogo_proceso_constructivo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_proceso_constructivo
    ADD CONSTRAINT catalogo_proceso_constructivo_pkey PRIMARY KEY (id);


--
-- Name: cms_videos cms_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_videos
    ADD CONSTRAINT cms_videos_pkey PRIMARY KEY (id);


--
-- Name: email_notifications email_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notifications
    ADD CONSTRAINT email_notifications_pkey PRIMARY KEY (id);


--
-- Name: estado_expediente estado_expediente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estado_expediente
    ADD CONSTRAINT estado_expediente_pkey PRIMARY KEY (id);


--
-- Name: etapa_expediente etapa_expediente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etapa_expediente
    ADD CONSTRAINT etapa_expediente_pkey PRIMARY KEY (id);


--
-- Name: evaluation_configs evaluation_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_configs
    ADD CONSTRAINT evaluation_configs_pkey PRIMARY KEY (key);


--
-- Name: evidencia_eventos evidencia_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia_eventos
    ADD CONSTRAINT evidencia_eventos_pkey PRIMARY KEY (id);


--
-- Name: expediente_cliente expediente_cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente_cliente
    ADD CONSTRAINT expediente_cliente_pkey PRIMARY KEY (id);


--
-- Name: expediente expediente_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente
    ADD CONSTRAINT expediente_codigo_key UNIQUE (codigo);


--
-- Name: expediente_etapa_historial expediente_etapa_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente_etapa_historial
    ADD CONSTRAINT expediente_etapa_historial_pkey PRIMARY KEY (id);


--
-- Name: expediente expediente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente
    ADD CONSTRAINT expediente_pkey PRIMARY KEY (id);


--
-- Name: fotografia fotografia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotografia
    ADD CONSTRAINT fotografia_pkey PRIMARY KEY (id);


--
-- Name: gasto_caso gasto_caso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_caso
    ADD CONSTRAINT gasto_caso_pkey PRIMARY KEY (id);


--
-- Name: gasto_plantilla gasto_plantilla_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_plantilla
    ADD CONSTRAINT gasto_plantilla_pkey PRIMARY KEY (id);


--
-- Name: historial_precio_proceso historial_precio_proceso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_precio_proceso
    ADD CONSTRAINT historial_precio_proceso_pkey PRIMARY KEY (id);


--
-- Name: inquiries inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);


--
-- Name: inquiry_events inquiry_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiry_events
    ADD CONSTRAINT inquiry_events_pkey PRIMARY KEY (id);


--
-- Name: liquidador liquidador_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidador
    ADD CONSTRAINT liquidador_nombre_key UNIQUE (nombre);


--
-- Name: liquidador liquidador_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidador
    ADD CONSTRAINT liquidador_pkey PRIMARY KEY (id);


--
-- Name: material_liquidador material_liquidador_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_liquidador
    ADD CONSTRAINT material_liquidador_pkey PRIMARY KEY (id);


--
-- Name: partida_dano partida_dano_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_dano
    ADD CONSTRAINT partida_dano_pkey PRIMARY KEY (id);


--
-- Name: partida_presupuesto_ajuste partida_presupuesto_ajuste_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_presupuesto_ajuste
    ADD CONSTRAINT partida_presupuesto_ajuste_pkey PRIMARY KEY (id);


--
-- Name: presupuesto_ajuste presupuesto_ajuste_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_ajuste
    ADD CONSTRAINT presupuesto_ajuste_pkey PRIMARY KEY (id);


--
-- Name: proceso_liquidador proceso_liquidador_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proceso_liquidador
    ADD CONSTRAINT proceso_liquidador_pkey PRIMARY KEY (id);


--
-- Name: progress_updates progress_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_updates
    ADD CONSTRAINT progress_updates_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key);


--
-- Name: recurso_apu recurso_apu_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurso_apu
    ADD CONSTRAINT recurso_apu_pkey PRIMARY KEY (id);


--
-- Name: sector_expediente sector_expediente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sector_expediente
    ADD CONSTRAINT sector_expediente_pkey PRIMARY KEY (id);


--
-- Name: unidad_medida unidad_medida_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidad_medida
    ADD CONSTRAINT unidad_medida_pkey PRIMARY KEY (id);


--
-- Name: email_notifications uq_email_inquiry_kind; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notifications
    ADD CONSTRAINT uq_email_inquiry_kind UNIQUE (inquiry_id, kind);


--
-- Name: expediente_cliente uq_expediente_cliente; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente_cliente
    ADD CONSTRAINT uq_expediente_cliente UNIQUE (expediente_id, usuario_id);


--
-- Name: presupuesto_ajuste uq_expediente_presupuesto_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_ajuste
    ADD CONSTRAINT uq_expediente_presupuesto_version UNIQUE (expediente_id, version);


--
-- Name: sector_expediente uq_expediente_sector; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sector_expediente
    ADD CONSTRAINT uq_expediente_sector UNIQUE (expediente_id, nombre);


--
-- Name: gasto_plantilla uq_gasto_catalogo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_plantilla
    ADD CONSTRAINT uq_gasto_catalogo UNIQUE (catalogo_id, codigo);


--
-- Name: inquiries uq_inquiries_reference; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT uq_inquiries_reference UNIQUE (reference);


--
-- Name: inquiries uq_inquiries_request_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT uq_inquiries_request_id UNIQUE (request_id);


--
-- Name: material_liquidador uq_material_catalogo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_liquidador
    ADD CONSTRAINT uq_material_catalogo UNIQUE (catalogo_id, codigo);


--
-- Name: proceso_liquidador uq_proceso_catalogo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proceso_liquidador
    ADD CONSTRAINT uq_proceso_catalogo UNIQUE (catalogo_id, codigo);


--
-- Name: usuario usuario_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_email_key UNIQUE (email);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id);


--
-- Name: version_informe version_informe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.version_informe
    ADD CONSTRAINT version_informe_pkey PRIMARY KEY (id);


--
-- Name: idx_carousel_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carousel_order ON public.carousel_slides USING btree (order_index, active);


--
-- Name: idx_cms_videos_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_videos_order ON public.cms_videos USING btree (order_index, active);


--
-- Name: idx_cms_videos_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_videos_provider ON public.cms_videos USING btree (provider, video_id);


--
-- Name: idx_email_status_next; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_status_next ON public.email_notifications USING btree (status, next_attempt_at);


--
-- Name: idx_etapa_historial_expediente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_etapa_historial_expediente ON public.expediente_etapa_historial USING btree (expediente_id, created_at);


--
-- Name: idx_events_inquiry_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_inquiry_created ON public.inquiry_events USING btree (inquiry_id, created_at);


--
-- Name: idx_evidencia_eventos_foto_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evidencia_eventos_foto_fecha ON public.evidencia_eventos USING btree (fotografia_id, created_at);


--
-- Name: idx_expediente_cliente_expediente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expediente_cliente_expediente ON public.expediente_cliente USING btree (expediente_id);


--
-- Name: idx_expediente_cliente_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expediente_cliente_usuario ON public.expediente_cliente USING btree (usuario_id);


--
-- Name: idx_expediente_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expediente_codigo ON public.expediente USING btree (codigo);


--
-- Name: idx_expediente_liquidador; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expediente_liquidador ON public.expediente USING btree (liquidador_id);


--
-- Name: idx_fotografia_dano_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fotografia_dano_id ON public.fotografia USING btree (dano_id);


--
-- Name: idx_fotografia_expediente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fotografia_expediente ON public.fotografia USING btree (expediente_id);


--
-- Name: idx_fotografia_expediente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fotografia_expediente_id ON public.fotografia USING btree (expediente_id);


--
-- Name: idx_fotografia_sector_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fotografia_sector_id ON public.fotografia USING btree (sector_id);


--
-- Name: idx_historial_proceso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historial_proceso ON public.historial_precio_proceso USING btree (proceso_id, fecha_vigencia DESC);


--
-- Name: idx_inquiries_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_created_at ON public.inquiries USING btree (created_at DESC);


--
-- Name: idx_inquiries_email_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_email_hash ON public.inquiries USING btree (email_hash);


--
-- Name: idx_inquiries_owner_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_owner_created ON public.inquiries USING btree (owner_id, created_at);


--
-- Name: idx_inquiries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_status ON public.inquiries USING btree (status);


--
-- Name: idx_partida_ajuste_dano; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partida_ajuste_dano ON public.partida_presupuesto_ajuste USING btree (dano_id);


--
-- Name: idx_partida_ajuste_presupuesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partida_ajuste_presupuesto ON public.partida_presupuesto_ajuste USING btree (presupuesto_id);


--
-- Name: idx_partida_expediente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partida_expediente ON public.partida_dano USING btree (expediente_id);


--
-- Name: idx_partida_sector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partida_sector ON public.partida_dano USING btree (sector);


--
-- Name: idx_presupuesto_expediente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presupuesto_expediente ON public.presupuesto_ajuste USING btree (expediente_id);


--
-- Name: idx_progress_inquiry_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_inquiry_created ON public.progress_updates USING btree (inquiry_id, created_at);


--
-- Name: idx_rate_limits_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_expires ON public.rate_limits USING btree (expires_at);


--
-- Name: idx_recurso_partida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurso_partida ON public.recurso_apu USING btree (partida_id);


--
-- Name: idx_sector_expediente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sector_expediente_id ON public.sector_expediente USING btree (expediente_id);


--
-- Name: inquiries trg_inquiries_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inquiries_timestamp BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: v_inquiries trg_v_inquiries_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_v_inquiries_insert INSTEAD OF INSERT ON public.v_inquiries FOR EACH ROW EXECUTE FUNCTION public.fn_v_inquiries_insert();


--
-- Name: v_inquiries trg_v_inquiries_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_v_inquiries_update INSTEAD OF UPDATE ON public.v_inquiries FOR EACH ROW EXECUTE FUNCTION public.fn_v_inquiries_update();


--
-- Name: asignacion_ajustador asignacion_ajustador_ajustador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignacion_ajustador
    ADD CONSTRAINT asignacion_ajustador_ajustador_id_fkey FOREIGN KEY (ajustador_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- Name: asignacion_ajustador asignacion_ajustador_asignado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignacion_ajustador
    ADD CONSTRAINT asignacion_ajustador_asignado_por_fkey FOREIGN KEY (asignado_por) REFERENCES public.usuario(id);


--
-- Name: asignacion_ajustador asignacion_ajustador_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignacion_ajustador
    ADD CONSTRAINT asignacion_ajustador_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expediente(id) ON DELETE CASCADE;


--
-- Name: auditoria_log auditoria_log_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_log
    ADD CONSTRAINT auditoria_log_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expediente(id) ON DELETE SET NULL;


--
-- Name: auditoria_log auditoria_log_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_log
    ADD CONSTRAINT auditoria_log_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- Name: catalogo_liquidador catalogo_liquidador_liquidador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_liquidador
    ADD CONSTRAINT catalogo_liquidador_liquidador_id_fkey FOREIGN KEY (liquidador_id) REFERENCES public.liquidador(id) ON DELETE CASCADE;


--
-- Name: catalogo_proceso_constructivo catalogo_proceso_constructivo_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_proceso_constructivo
    ADD CONSTRAINT catalogo_proceso_constructivo_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.unidad_medida(id);


--
-- Name: evidencia_eventos evidencia_eventos_fotografia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia_eventos
    ADD CONSTRAINT evidencia_eventos_fotografia_id_fkey FOREIGN KEY (fotografia_id) REFERENCES public.fotografia(id) ON DELETE CASCADE;


--
-- Name: evidencia_eventos evidencia_eventos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia_eventos
    ADD CONSTRAINT evidencia_eventos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- Name: expediente expediente_ajustador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente
    ADD CONSTRAINT expediente_ajustador_id_fkey FOREIGN KEY (ajustador_id) REFERENCES public.usuario(id);


--
-- Name: expediente_cliente expediente_cliente_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente_cliente
    ADD CONSTRAINT expediente_cliente_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expediente(id) ON DELETE CASCADE;


--
-- Name: expediente_cliente expediente_cliente_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente_cliente
    ADD CONSTRAINT expediente_cliente_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- Name: expediente expediente_etapa_actual_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente
    ADD CONSTRAINT expediente_etapa_actual_fkey FOREIGN KEY (etapa_actual) REFERENCES public.etapa_expediente(id);


--
-- Name: expediente_etapa_historial expediente_etapa_historial_etapa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente_etapa_historial
    ADD CONSTRAINT expediente_etapa_historial_etapa_id_fkey FOREIGN KEY (etapa_id) REFERENCES public.etapa_expediente(id);


--
-- Name: expediente_etapa_historial expediente_etapa_historial_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente_etapa_historial
    ADD CONSTRAINT expediente_etapa_historial_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expediente(id) ON DELETE CASCADE;


--
-- Name: expediente_etapa_historial expediente_etapa_historial_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente_etapa_historial
    ADD CONSTRAINT expediente_etapa_historial_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- Name: expediente expediente_inspector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente
    ADD CONSTRAINT expediente_inspector_id_fkey FOREIGN KEY (inspector_id) REFERENCES public.usuario(id);


--
-- Name: expediente expediente_liquidador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente
    ADD CONSTRAINT expediente_liquidador_id_fkey FOREIGN KEY (liquidador_id) REFERENCES public.liquidador(id);


--
-- Name: email_notifications fk_email_inquiry; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notifications
    ADD CONSTRAINT fk_email_inquiry FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inquiry_events fk_events_inquiry; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiry_events
    ADD CONSTRAINT fk_events_inquiry FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: expediente fk_expediente_estado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente
    ADD CONSTRAINT fk_expediente_estado FOREIGN KEY (estado) REFERENCES public.estado_expediente(id);


--
-- Name: progress_updates fk_progress_inquiry; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_updates
    ADD CONSTRAINT fk_progress_inquiry FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fotografia fotografia_dano_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotografia
    ADD CONSTRAINT fotografia_dano_id_fkey FOREIGN KEY (dano_id) REFERENCES public.partida_dano(id) ON DELETE SET NULL;


--
-- Name: fotografia fotografia_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotografia
    ADD CONSTRAINT fotografia_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expediente(id) ON DELETE CASCADE;


--
-- Name: fotografia fotografia_partida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotografia
    ADD CONSTRAINT fotografia_partida_id_fkey FOREIGN KEY (partida_id) REFERENCES public.partida_dano(id) ON DELETE SET NULL;


--
-- Name: fotografia fotografia_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotografia
    ADD CONSTRAINT fotografia_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sector_expediente(id) ON DELETE SET NULL;


--
-- Name: fotografia fotografia_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotografia
    ADD CONSTRAINT fotografia_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- Name: gasto_caso gasto_caso_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_caso
    ADD CONSTRAINT gasto_caso_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expediente(id) ON DELETE CASCADE;


--
-- Name: gasto_plantilla gasto_plantilla_catalogo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto_plantilla
    ADD CONSTRAINT gasto_plantilla_catalogo_id_fkey FOREIGN KEY (catalogo_id) REFERENCES public.catalogo_liquidador(id) ON DELETE CASCADE;


--
-- Name: historial_precio_proceso historial_precio_proceso_ajustador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_precio_proceso
    ADD CONSTRAINT historial_precio_proceso_ajustador_id_fkey FOREIGN KEY (ajustador_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- Name: historial_precio_proceso historial_precio_proceso_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_precio_proceso
    ADD CONSTRAINT historial_precio_proceso_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expediente(id) ON DELETE CASCADE;


--
-- Name: historial_precio_proceso historial_precio_proceso_proceso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_precio_proceso
    ADD CONSTRAINT historial_precio_proceso_proceso_id_fkey FOREIGN KEY (proceso_id) REFERENCES public.catalogo_proceso_constructivo(id) ON DELETE CASCADE;


--
-- Name: material_liquidador material_liquidador_catalogo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_liquidador
    ADD CONSTRAINT material_liquidador_catalogo_id_fkey FOREIGN KEY (catalogo_id) REFERENCES public.catalogo_liquidador(id) ON DELETE CASCADE;


--
-- Name: material_liquidador material_liquidador_unidad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_liquidador
    ADD CONSTRAINT material_liquidador_unidad_fkey FOREIGN KEY (unidad) REFERENCES public.unidad_medida(id);


--
-- Name: partida_dano partida_dano_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_dano
    ADD CONSTRAINT partida_dano_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expediente(id) ON DELETE CASCADE;


--
-- Name: partida_dano partida_dano_proceso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_dano
    ADD CONSTRAINT partida_dano_proceso_id_fkey FOREIGN KEY (proceso_id) REFERENCES public.proceso_liquidador(id);


--
-- Name: partida_dano partida_dano_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_dano
    ADD CONSTRAINT partida_dano_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sector_expediente(id) ON DELETE SET NULL;


--
-- Name: partida_dano partida_dano_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_dano
    ADD CONSTRAINT partida_dano_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.unidad_medida(id);


--
-- Name: partida_presupuesto_ajuste partida_presupuesto_ajuste_dano_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_presupuesto_ajuste
    ADD CONSTRAINT partida_presupuesto_ajuste_dano_id_fkey FOREIGN KEY (dano_id) REFERENCES public.partida_dano(id) ON DELETE SET NULL;


--
-- Name: partida_presupuesto_ajuste partida_presupuesto_ajuste_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_presupuesto_ajuste
    ADD CONSTRAINT partida_presupuesto_ajuste_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expediente(id) ON DELETE CASCADE;


--
-- Name: partida_presupuesto_ajuste partida_presupuesto_ajuste_presupuesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_presupuesto_ajuste
    ADD CONSTRAINT partida_presupuesto_ajuste_presupuesto_id_fkey FOREIGN KEY (presupuesto_id) REFERENCES public.presupuesto_ajuste(id) ON DELETE CASCADE;


--
-- Name: partida_presupuesto_ajuste partida_presupuesto_ajuste_proceso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_presupuesto_ajuste
    ADD CONSTRAINT partida_presupuesto_ajuste_proceso_id_fkey FOREIGN KEY (proceso_id) REFERENCES public.catalogo_proceso_constructivo(id) ON DELETE SET NULL;


--
-- Name: partida_presupuesto_ajuste partida_presupuesto_ajuste_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_presupuesto_ajuste
    ADD CONSTRAINT partida_presupuesto_ajuste_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sector_expediente(id) ON DELETE SET NULL;


--
-- Name: partida_presupuesto_ajuste partida_presupuesto_ajuste_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_presupuesto_ajuste
    ADD CONSTRAINT partida_presupuesto_ajuste_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.unidad_medida(id);


--
-- Name: partida_presupuesto_ajuste partida_presupuesto_ajuste_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partida_presupuesto_ajuste
    ADD CONSTRAINT partida_presupuesto_ajuste_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- Name: presupuesto_ajuste presupuesto_ajuste_ajustador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_ajuste
    ADD CONSTRAINT presupuesto_ajuste_ajustador_id_fkey FOREIGN KEY (ajustador_id) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- Name: presupuesto_ajuste presupuesto_ajuste_aprobado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_ajuste
    ADD CONSTRAINT presupuesto_ajuste_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES public.usuario(id);


--
-- Name: presupuesto_ajuste presupuesto_ajuste_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_ajuste
    ADD CONSTRAINT presupuesto_ajuste_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expediente(id) ON DELETE CASCADE;


--
-- Name: proceso_liquidador proceso_liquidador_catalogo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proceso_liquidador
    ADD CONSTRAINT proceso_liquidador_catalogo_id_fkey FOREIGN KEY (catalogo_id) REFERENCES public.catalogo_liquidador(id) ON DELETE CASCADE;


--
-- Name: proceso_liquidador proceso_liquidador_unidad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proceso_liquidador
    ADD CONSTRAINT proceso_liquidador_unidad_fkey FOREIGN KEY (unidad) REFERENCES public.unidad_medida(id);


--
-- Name: recurso_apu recurso_apu_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurso_apu
    ADD CONSTRAINT recurso_apu_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material_liquidador(id);


--
-- Name: recurso_apu recurso_apu_partida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurso_apu
    ADD CONSTRAINT recurso_apu_partida_id_fkey FOREIGN KEY (partida_id) REFERENCES public.partida_dano(id) ON DELETE CASCADE;


--
-- Name: sector_expediente sector_expediente_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sector_expediente
    ADD CONSTRAINT sector_expediente_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expediente(id) ON DELETE CASCADE;


--
-- Name: sector_expediente sector_expediente_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sector_expediente
    ADD CONSTRAINT sector_expediente_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- Name: version_informe version_informe_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.version_informe
    ADD CONSTRAINT version_informe_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expediente(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


