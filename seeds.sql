-- =============================================================================
-- DATOS INICIALES DE PRUEBA (SEEDS): ASESORÍAS LORENS
-- =============================================================================

-- 1. Unidades de Medida
INSERT INTO unidad_medida (id, etiqueta, dimension, escala) VALUES
('m²', 'm²', 'area', 1.0),
('ml', 'ml', 'length', 1.0),
('m³', 'm³', 'volume', 1.0),
('un', 'un', 'count', 1.0),
('gl', 'gl', 'direct', 1.0),
('kg', 'kg', 'direct', 1.0),
('L', 'L', 'direct', 1.0),
('día', 'día', 'direct', 1.0)
ON CONFLICT (id) DO NOTHING;

-- 2. Usuarios de Prueba (Password: Webmaster2026! / Admin2026!)
-- Hash correspondiente a bcrypt de Webmaster2026! y Admin2026!
-- Solo los usuarios con doble_perfil = TRUE pueden alternar entre Inspector y Administrador
INSERT INTO usuario (id, nombre, email, password_hash, rol, doble_perfil, roles) VALUES
('a0000000-0000-0000-0000-000000000000', 'Webmaster Lorens (Admin General)', 'webmaster@lorens.cl', 
'$2a$10$uXJDvaQNjpEaIXDMGoADe.fKoAnR8Rg2s1LDxyaXiYPJeEubjdFYW', 'admin', TRUE, ARRAY['admin', 'inspector']),
('a0000000-0000-0000-0000-000000000001', 'Pedro Pérez (Inspector)', 'inspector@lorens.cl', 
'$2a$10$xfVScSVmTtaZ6R/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC', 'inspector', FALSE, ARRAY['inspector']),
('a0000000-0000-0000-0000-000000000002', 'Alejandro Vargas (Admin)', 'admin@lorens.cl', 
'$2a$10$xfVScSVmTtaZ6R/RqXxwe.O7Mueq2dndJKnqZUBnXJWF1/hcHKMRC', 'admin', FALSE, ARRAY['admin'])
ON CONFLICT (email) DO UPDATE SET 
  password_hash = EXCLUDED.password_hash, 
  rol = EXCLUDED.rol,
  doble_perfil = EXCLUDED.doble_perfil,
  roles = EXCLUDED.roles;

-- 3. Liquidadores de Referencia
INSERT INTO liquidador (id, nombre, rut, email_contacto) VALUES
('b0000000-0000-0000-0000-000000000001', 'SEGURED / COOPER', '76.123.456-7', 'siniestros@segured.cl'),
('b0000000-0000-0000-0000-000000000002', 'JUAN PABLO VALDIVIESO', '76.987.654-3', 'contacto@jpv.cl')
ON CONFLICT (nombre) DO NOTHING;

-- Catálogo de Segured/Cooper
INSERT INTO catalogo_liquidador (id, liquidador_id, version, vigente) VALUES
('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 1, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3.b Catálogo Oficial de Estados de Expediente
INSERT INTO estado_expediente (id, nombre, descripcion, color, badge_clase, orden) VALUES
('activo', 'Activo', 'Expediente en curso de inspección o liquidación activa', '#10b981', 'green lighten-5 green-text text-darken-3', 1),
('en_espera', 'En espera', 'Expediente pausado, en espera de documentación o peritaje adicional', '#f59e0b', 'amber lighten-5 amber-text text-darken-4', 2),
('procesado', 'Procesado', 'Expediente liquidado, revisado y procesado oficialmente', '#3b82f6', 'blue lighten-5 blue-text text-darken-3', 3)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  color = EXCLUDED.color,
  badge_clase = EXCLUDED.badge_clase,
  orden = EXCLUDED.orden;

-- 4. Procesos Constructivos de Segured/Cooper con tarifas iniciales
INSERT INTO proceso_liquidador (catalogo_id, codigo, nombre, categoria, unidad, precio_unitario) VALUES
('c0000000-0000-0000-0000-000000000001', 'PRO-PREP', 'Preparación de superficie', 'Pintura', 'm²', 1000.00),
('c0000000-0000-0000-0000-000000000001', 'PRO-EMP', 'Provi. y aplicación de empaste', 'Pintura', 'ml', 1000.00),
('c0000000-0000-0000-0000-000000000001', 'PRO-FIS', 'Reparación de Fisura', 'Estructuras', 'ml', 1000.00),
('c0000000-0000-0000-0000-000000000001', 'PRO-PINT', 'Provi. y aplicación de pintura dos manos', 'Pintura', 'm²', 1000.00),
('c0000000-0000-0000-0000-000000000001', 'PRO-MART', 'Provi. y aplicación de martelina', 'Terminaciones', 'ml', 1000.00)
ON CONFLICT (catalogo_id, codigo) DO NOTHING;

-- 5. Casos de Prueba con Diferentes Estados (Activo, En espera, Procesado)
INSERT INTO expediente (
    id, codigo, cliente_nombre, cliente_rut, cliente_email, direccion, comuna, ciudad,
    liquidador_id, estado, tipo_evento, fecha_evento, fecha_visita, inspector_nombre,
    porcentaje_gg, porcentaje_utilidad, tasa_iva
) VALUES 
(
    'd0000000-0000-0000-0000-000000000001', 'SIS-2026-084', 'Juan Pérez', '12.345.678-9', 'juan.perez@gmail.com',
    'Av. Arturo Prat, 2043, Alto Hospicio', 'Alto Hospicio', 'Alto Hospicio',
    'b0000000-0000-0000-0000-000000000001', 'activo', 'Sismo', '2026-05-31', '2026-06-02', 'PEDRO PÉREZ',
    25.00, 0.00, 19.00
),
(
    'd0000000-0000-0000-0000-000000000002', 'SIS-2026-085', 'María González', '14.892.123-K', 'maria.gonzalez@gmail.com',
    'Calle Los Álamos 450, Iquique', 'Iquique', 'Iquique',
    'b0000000-0000-0000-0000-000000000001', 'en_espera', 'Incendio parcial', '2026-06-01', '2026-06-03', 'PEDRO PÉREZ',
    25.00, 0.00, 19.00
),
(
    'd0000000-0000-0000-0000-000000000003', 'SIS-2026-086', 'Roberto Silva', '9.765.432-1', 'roberto.silva@empresa.cl',
    'Pasaje Central 128, Pozo Almonte', 'Pozo Almonte', 'Pozo Almonte',
    'b0000000-0000-0000-0000-000000000002', 'procesado', 'Inundación Matriz', '2026-05-20', '2026-05-22', 'PEDRO PÉREZ',
    20.00, 5.00, 19.00
)
ON CONFLICT (codigo) DO UPDATE SET
  estado = EXCLUDED.estado,
  cliente_nombre = EXCLUDED.cliente_nombre,
  direccion = EXCLUDED.direccion;

-- 6. Partidas del Caso SIS-2026-084: BAÑO 1 (Muro L: 2.4, W: 1.3, H: 2.4 m)
INSERT INTO partida_dano (
    id, expediente_id, sector, elemento, dano_tipo, descripcion_dano, reparacion_propuesta,
    unidad_id, metodo_calculo, largo, ancho, alto, cantidad_medida, precio_unitario_neto, 
    subtotal_neto, precio_verificado
) VALUES
('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'Muro', 'Fisura', 'Fisuras superficiales y desprendimiento', 'Preparación de superficie', 'm²', 'direct', 2.4, 1.3, 2.4, 12.30, 1000.00, 12300.00, TRUE),
('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'Muro', 'Fisura', 'Fisuras en paño húmedo', 'Provi. y aplicación de empaste', 'ml', 'direct', 0, 0, 0, 1.50, 1000.00, 1500.00, TRUE),
('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'Muro', 'Fisura', 'Tratamiento de grieta no estructural', 'Reparación de Fisura', 'ml', 'direct', 0, 0, 0, 1.50, 1000.00, 1500.00, TRUE),
('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'Muro', 'Terminación', 'Pintura esmalte al agua', 'Provi. y aplicación de pintura dos manos', 'm²', 'direct', 2.4, 1.3, 2.4, 13.50, 1000.00, 13500.00, TRUE),
('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'BAÑO 1', 'Muro', 'Terminación', 'Revestimiento martelina', 'Provi. y aplicación de martelina', 'ml', 'direct', 0, 0, 0, 1.50, 1000.00, 1500.00, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 7. Gastos Operativos (Flete, Escombros, Aseo, Protección)
INSERT INTO gasto_caso (id, expediente_id, categoria, descripcion, unidad, cantidad, precio_unitario_neto, subtotal_neto, verificado) VALUES
('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Flete', 'Flete de materiales a obra', 'gl', 1.0, 1810.00, 1810.00, TRUE),
('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Retiro de escombros', 'Retiro a vertedero municipal autorizado', 'gl', 1.0, 1810.00, 1810.00, TRUE),
('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Aseo y entrega', 'Aseo y entrega final de sectores intervenidos', 'gl', 1.0, 1810.00, 1810.00, TRUE),
('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'Protección', 'Protección de áreas de trabajo no dañadas', 'gl', 1.0, 1810.00, 1810.00, TRUE)
ON CONFLICT (id) DO NOTHING;

