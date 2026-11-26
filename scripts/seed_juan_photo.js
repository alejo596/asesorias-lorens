const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function seedJuanPhoto() {
  const dir = path.join(__dirname, '..', 'storage', 'expedientes', 'd0000000-0000-0000-0000-000000000001', 'originales');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'evidencia_fachada_084.jpg');
  const sampleJpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  fs.writeFileSync(filePath, sampleJpg);

  const query = `
    INSERT INTO fotografia (
      id, expediente_id, nombre_original, nombre_archivo, ruta_almacenamiento,
      ruta_thumbnail, sector, descripcion, mime_type, tamano_bytes, visible_cliente
    ) VALUES (
      '5e6ad203-b43a-4990-88e2-ed2ef98367c5',
      'd0000000-0000-0000-0000-000000000001',
      'fachada_muro.jpg',
      'evidencia_fachada_084.jpg',
      'expedientes/d0000000-0000-0000-0000-000000000001/originales/evidencia_fachada_084.jpg',
      'expedientes/d0000000-0000-0000-0000-000000000001/originales/evidencia_fachada_084.jpg',
      'FACHADA',
      'Fisuras diagonales en muro principal por asentamiento pericial',
      'image/jpeg',
      134,
      TRUE
    )
    ON CONFLICT (id) DO UPDATE SET visible_cliente = TRUE, expediente_id = EXCLUDED.expediente_id;
  `;

  await db.query(query);
  console.log('✓ Evidencia fotográfica autorizada sembrada para caso SIS-2026-084 (Juan Pérez)');
  process.exit(0);
}

seedJuanPhoto().catch(err => {
  console.error(err);
  process.exit(1);
});

