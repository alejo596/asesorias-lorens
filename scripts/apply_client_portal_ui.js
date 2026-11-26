const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// 1. Modificar la pantalla de login para agregar el selector "Personal Lorens" vs "Portal Clientes"
console.log('1. Integrando Portal del Cliente en login de index.html...');

const oldLoginCardStart = `<div class="login-container-card">`;
const newLoginSwitcher = `<div class="login-container-card">
            <!-- Selector de Perfil de Acceso: Personal Lorens vs Portal Clientes -->
            <div class="login-type-switcher">
                <button type="button" id="tab-login-staff" class="btn-login-tab active" onclick="switchLoginType('staff')">
                    <i class="material-icons tiny">business</i> Personal Lorens
                </button>
                <button type="button" id="tab-login-client" class="btn-login-tab" onclick="switchLoginType('client')">
                    <i class="material-icons tiny">person_pin</i> Portal Clientes
                </button>
            </div>

            <!-- Contenedor 1: Personal Lorens (Webmaster / Admin / Inspector) -->
            <div id="login-staff-box">`;

if (indexHtml.includes(oldLoginCardStart) && !indexHtml.includes('login-type-switcher')) {
  indexHtml = indexHtml.replace(oldLoginCardStart, newLoginSwitcher);

  // Cerrar login-staff-box e insertar login-client-box antes del cierre de login-container-card
  const staffCloseTarget = `            <div class="quick-profile-btn" onclick="quickLogin('inspector', 'Admin2026!')">
                <div class="quick-profile-icon" style="background: #fef3c7; color: #d97706;">
                    <i class="material-icons" style="font-size: 1.25rem;">smartphone</i>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 0.88rem; color: #b45309;">Pedro Pérez (Inspector Fijo)
                    </div>
                    <div style="font-size: 0.73rem; color: var(--slate-500);">Usuario: <code>inspector</code> | Rol BD:
                        <strong>Solo Inspector (Fijo)</strong></div>
                </div>
                <i class="material-icons grey-text" style="font-size: 1.2rem;">arrow_forward</i>
            </div>
        </div>`;

  const clientBoxHtml = `            <div class="quick-profile-btn" onclick="quickLogin('inspector', 'Admin2026!')">
                <div class="quick-profile-icon" style="background: #fef3c7; color: #d97706;">
                    <i class="material-icons" style="font-size: 1.25rem;">smartphone</i>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 0.88rem; color: #b45309;">Pedro Pérez (Inspector Fijo)
                    </div>
                    <div style="font-size: 0.73rem; color: var(--slate-500);">Usuario: <code>inspector</code> | Rol BD:
                        <strong>Solo Inspector (Fijo)</strong></div>
                </div>
                <i class="material-icons grey-text" style="font-size: 1.2rem;">arrow_forward</i>
            </div>
            </div> <!-- /#login-staff-box -->

            <!-- Contenedor 2: Portal del Cliente (Asegurados) -->
            <div id="login-client-box" style="display: none;">
                <div class="login-brand-header" style="margin-bottom: 18px;">
                    <div class="login-brand-icon" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: white;">
                        <i class="material-icons">domain_verification</i>
                    </div>
                    <h4 class="login-title" style="color: #0f172a; margin-top: 10px;">PORTAL DEL CLIENTE</h4>
                    <p class="login-subtitle">Consulte el estado de sus siniestros de manera segura.</p>
                    <div style="margin-top: 8px;">
                        <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; background: #e0f2fe; color: #0284c7; padding: 4px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="material-icons tiny">verified</i> Acceso Clientes y Titulares
                        </span>
                    </div>
                </div>

                <!-- Alerta de error cliente -->
                <div id="client-login-error-alert" class="card-panel red lighten-5 red-text text-darken-4"
                    style="display: none; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 16px;">
                </div>

                <form id="form-client-login" onsubmit="handleClientLoginSubmit(event)">
                    <div class="input-field" style="margin-bottom: 14px;">
                        <i class="material-icons prefix grey-text">mail_outline</i>
                        <input id="client-login-email" type="email" required autocomplete="username">
                        <label for="client-login-email">Correo Electrónico</label>
                        <span class="helper-text" style="font-size: 0.75rem;">Ej: juan.perez@gmail.com</span>
                    </div>

                    <div class="input-field" style="margin-bottom: 16px; position: relative;">
                        <i class="material-icons prefix grey-text">lock_outline</i>
                        <input id="client-login-password" type="password" required autocomplete="current-password">
                        <label for="client-login-password">Contraseña</label>
                        <i class="material-icons" id="btn-toggle-client-password"
                            onclick="toggleClientPasswordVisibility()"
                            style="position: absolute; right: 8px; top: 12px; cursor: pointer; color: #94a3b8; font-size: 1.3rem;">visibility</i>
                    </div>

                    <button type="submit" id="btn-submit-client-login" class="btn btn-large waves-effect waves-light"
                        style="width: 100%; border-radius: 8px; font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 4px 14px rgba(2, 132, 199, 0.3);">
                        <i class="material-icons left">login</i>Ingresar a mi portal
                    </button>

                    <div class="center-align" style="margin-top: 14px;">
                        <a href="#!" onclick="promptForgotPassword()" style="color: #0284c7; font-size: 0.82rem; font-weight: 600; text-decoration: underline;">
                            ¿Olvidó su contraseña?
                        </a>
                    </div>
                </form>

                <div class="quick-profiles-title" style="margin-top: 24px;">
                    <i class="material-icons tiny">bolt</i> Acceso Rápido de Prueba — Clientes
                </div>

                <div class="quick-profile-btn" onclick="quickClientLogin('juan.perez@gmail.com', 'Cliente2026!')">
                    <div class="quick-profile-icon" style="background: #e0f2fe; color: #0284c7;">
                        <i class="material-icons" style="font-size: 1.25rem;">person</i>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 0.88rem; color: #0369a1;">Juan Pérez (Asegurado)</div>
                        <div style="font-size: 0.73rem; color: var(--slate-500);">Expediente: <code>SIS-2026-084</code> | Etapa: <strong>Evidencia (Timeline Habilitado)</strong></div>
                    </div>
                    <i class="material-icons grey-text" style="font-size: 1.2rem;">arrow_forward</i>
                </div>

                <div class="quick-profile-btn" onclick="quickClientLogin('maria.gonzalez@gmail.com', 'Cliente2026!')">
                    <div class="quick-profile-icon" style="background: #fef3c7; color: #d97706;">
                        <i class="material-icons" style="font-size: 1.25rem;">person_outline</i>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 0.88rem; color: #b45309;">María González (Asegurada)</div>
                        <div style="font-size: 0.73rem; color: var(--slate-500);">Expediente: <code>SIS-2026-085</code> | Etapa: <strong>Visita (Timeline Bloqueado)</strong></div>
                    </div>
                    <i class="material-icons grey-text" style="font-size: 1.2rem;">arrow_forward</i>
                </div>

                <div class="quick-profile-btn" onclick="quickClientLogin('roberto.silva@empresa.cl', 'Cliente2026!')">
                    <div class="quick-profile-icon" style="background: #dcfce7; color: #16a34a;">
                        <i class="material-icons" style="font-size: 1.25rem;">task_alt</i>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 0.88rem; color: #15803d;">Roberto Silva (Asegurado)</div>
                        <div style="font-size: 0.73rem; color: var(--slate-500);">Expediente: <code>SIS-2026-086</code> | Etapa: <strong>Finalizado (100% Completo)</strong></div>
                    </div>
                    <i class="material-icons grey-text" style="font-size: 1.2rem;">arrow_forward</i>
                </div>
            </div> <!-- /#login-client-box -->
        </div>`;

  indexHtml = indexHtml.replace(staffCloseTarget, clientBoxHtml);
  console.log('✓ Login actualizado con selector y formulario para Clientes.');
}

// 2. Insertar menú exclusivo del cliente en el sidebar
console.log('2. Integrando opciones del cliente en Sidebar...');
const sidebarAnchor = `<li class="sidebar-section-title">Principal</li>`;
const clientSidebarItems = `<li class="sidebar-section-title">Principal</li>

                    <!-- Ítems Exclusivos del Portal del Cliente -->
                    <li class="sidebar-menu-item sidebar-client-only" id="sidebar-item-client-dashboard" style="display: none;">
                        <a href="#client-dashboard" class="sidebar-menu-link active" onclick="switchClientView('dashboard')">
                            <i class="material-icons" style="color: #0284c7;">dashboard</i>
                            <span class="sidebar-text">Inicio</span>
                        </a>
                    </li>
                    <li class="sidebar-menu-item sidebar-client-only" id="sidebar-item-client-cases" style="display: none;">
                        <a href="#client-cases" class="sidebar-menu-link" onclick="switchClientView('cases')">
                            <i class="material-icons" style="color: #10b981;">folder_shared</i>
                            <span class="sidebar-text">Mis Expedientes</span>
                        </a>
                    </li>
                    <li class="sidebar-menu-item sidebar-client-only" id="sidebar-item-client-tracking" style="display: none;">
                        <a href="#client-tracking" class="sidebar-menu-link" onclick="switchClientView('tracking')">
                            <i class="material-icons" style="color: #f59e0b;">timeline</i>
                            <span class="sidebar-text">Seguimiento</span>
                        </a>
                    </li>`;

if (indexHtml.includes(sidebarAnchor) && !indexHtml.includes('sidebar-item-client-dashboard')) {
  indexHtml = indexHtml.replace(sidebarAnchor, clientSidebarItems);
  console.log('✓ Opciones del cliente integradas en Sidebar.');
}

// 3. Insertar contenedor principal #client-main-content antes de #inspector-main-content
console.log('3. Integrando contenedor principal #client-main-content...');
const inspectorContentAnchor = `<div id="inspector-main-content" style="display: none;">`;
const clientMainContentHtml = `<!-- ============================================================== -->
            <!-- MÓDULO EXCLUSIVO DEL PORTAL DEL CLIENTE (ASEGURADOS)           -->
            <!-- ============================================================== -->
            <div id="client-main-content" style="display: none;">
                <!-- Vista 1: Dashboard y Lista de Expedientes -->
                <div id="client-view-dashboard">
                    <!-- Hero Card del Cliente -->
                    <div class="client-hero-card">
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                            <div>
                                <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; background: rgba(2, 132, 199, 0.35); color: #38bdf8; padding: 3px 10px; border-radius: 4px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(56, 189, 248, 0.3);">
                                    <i class="material-icons tiny">domain_verification</i> PORTAL DE SEGUIMIENTO DE SINIESTROS
                                </span>
                                <h4 style="margin: 10px 0 6px 0; font-weight: 800; font-size: 1.45rem;">
                                    Bienvenido, <span id="client-hero-user-name">Estimado Asegurado</span>
                                </h4>
                                <p style="margin: 0; font-size: 0.9rem; color: #cbd5e1; max-width: 800px;">
                                    Consulte sus expedientes y conozca el avance de los procesos asociados a sus siniestros en tiempo real.
                                </p>
                            </div>
                            <div>
                                <button type="button" class="btn-flat white-text" style="background: rgba(255,255,255,0.1); border-radius: 8px; font-weight: 600; font-size: 0.8rem;" onclick="loadClientPortalData()">
                                    <i class="material-icons left tiny">refresh</i> Actualizar Datos
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 4 Tarjetas Indicadoras (KPIs) -->
                    <div class="row" style="margin-bottom: 20px;">
                        <div class="col s6 m3" style="padding: 0 6px; margin-bottom: 12px;">
                            <div class="client-kpi-card">
                                <div class="client-kpi-icon" style="background: #e0f2fe; color: #0284c7;">
                                    <i class="material-icons">folder</i>
                                </div>
                                <div class="client-kpi-info">
                                    <div class="client-kpi-val" id="client-kpi-total">0</div>
                                    <div class="client-kpi-lbl">Mis Expedientes</div>
                                </div>
                            </div>
                        </div>
                        <div class="col s6 m3" style="padding: 0 6px; margin-bottom: 12px;">
                            <div class="client-kpi-card">
                                <div class="client-kpi-icon" style="background: #dbeafe; color: #2563eb;">
                                    <i class="material-icons">sync</i>
                                </div>
                                <div class="client-kpi-info">
                                    <div class="client-kpi-val" id="client-kpi-proceso">0</div>
                                    <div class="client-kpi-lbl">En Proceso</div>
                                </div>
                            </div>
                        </div>
                        <div class="col s6 m3" style="padding: 0 6px; margin-bottom: 12px;">
                            <div class="client-kpi-card">
                                <div class="client-kpi-icon" style="background: #dcfce7; color: #16a34a;">
                                    <i class="material-icons">check_circle</i>
                                </div>
                                <div class="client-kpi-info">
                                    <div class="client-kpi-val" id="client-kpi-finalizados">0</div>
                                    <div class="client-kpi-lbl">Finalizados</div>
                                </div>
                            </div>
                        </div>
                        <div class="col s6 m3" style="padding: 0 6px; margin-bottom: 12px;">
                            <div class="client-kpi-card">
                                <div class="client-kpi-icon" style="background: #fef3c7; color: #d97706;">
                                    <i class="material-icons">pending_actions</i>
                                </div>
                                <div class="client-kpi-info">
                                    <div class="client-kpi-val" id="client-kpi-pendientes">0</div>
                                    <div class="client-kpi-lbl">Pendientes de Actualización</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sección MIS EXPEDIENTES -->
                    <div class="card" style="border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 30px;">
                        <div style="padding: 16px 20px; background: #ffffff; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <h5 style="margin: 0; font-weight: 800; font-size: 1.15rem; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                                    <i class="material-icons" style="color: #0284c7;">assignment</i> MIS EXPEDIENTES
                                </h5>
                                <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #64748b;">
                                    Haga clic en <strong>"Consultar seguimiento"</strong> en cualquier expediente para acceder al detalle de avance y línea de tiempo.
                                </p>
                            </div>
                            <div style="min-width: 200px;">
                                <input type="text" id="client-cases-search" placeholder="Filtrar por código o dirección..." onkeyup="filterClientCases(this.value)" style="margin: 0; height: 36px; font-size: 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 10px;">
                            </div>
                        </div>

                        <div style="padding: 0;">
                            <div id="client-cases-loading" class="center-align" style="padding: 40px 20px;">
                                <div class="preloader-wrapper small active">
                                    <div class="spinner-layer spinner-blue-only">
                                        <div class="circle-clipper left"><div class="circle"></div></div>
                                        <div class="gap-patch"><div class="circle"></div></div>
                                        <div class="circle-clipper right"><div class="circle"></div></div>
                                    </div>
                                </div>
                                <div style="margin-top: 8px; font-size: 0.8rem; color: #64748b;">Cargando sus expedientes desde el servidor...</div>
                            </div>

                            <div id="client-cases-container" style="display: none; padding: 12px;">
                                <!-- Se llena dinámicamente -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Vista 2: Ficha de Seguimiento y Línea de Tiempo del Expediente -->
                <div id="client-view-tracking" style="display: none;">
                    <div style="margin-bottom: 16px;">
                        <button type="button" class="btn-flat waves-effect" onclick="switchClientView('dashboard')" style="font-weight: 700; color: #0284c7; padding: 0; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="material-icons">arrow_back</i> Volver a Mis Expedientes
                        </button>
                    </div>

                    <!-- Ficha de Seguimiento del Expediente -->
                    <div class="client-case-sheet">
                        <div class="client-case-sheet-header">
                            <div>
                                <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 4px;" id="client-track-header-badge">
                                    EXPEDIENTE ACTIVO
                                </span>
                                <h4 style="margin: 6px 0 2px 0; font-size: 1.35rem; font-weight: 800; color: #0f172a;" id="client-track-codigo">
                                    SIS-2026-084
                                </h4>
                                <span style="font-size: 0.82rem; color: #64748b;" id="client-track-direccion">
                                    Av. Arturo Prat, 2043, Alto Hospicio
                                </span>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.72rem; color: #64748b; font-weight: 600;">AVANCE ESTIMADO</div>
                                <div style="font-size: 1.4rem; font-weight: 800; color: #0284c7;" id="client-track-avance">
                                    65%
                                </div>
                            </div>
                        </div>

                        <div class="client-case-sheet-body">
                            <div class="row" style="margin-bottom: 0;">
                                <div class="col s12 m4 l3" style="margin-bottom: 12px;">
                                    <span style="font-size: 0.72rem; color: #64748b; display: block; font-weight: 600;">N° DE SINIESTRO</span>
                                    <strong style="font-size: 0.88rem; color: #1e293b;" id="client-track-siniestro">-</strong>
                                </div>
                                <div class="col s12 m4 l3" style="margin-bottom: 12px;">
                                    <span style="font-size: 0.72rem; color: #64748b; display: block; font-weight: 600;">N° DE PÓLIZA</span>
                                    <strong style="font-size: 0.88rem; color: #1e293b;" id="client-track-poliza">-</strong>
                                </div>
                                <div class="col s12 m4 l3" style="margin-bottom: 12px;">
                                    <span style="font-size: 0.72rem; color: #64748b; display: block; font-weight: 600;">TIPO DE EVENTO</span>
                                    <strong style="font-size: 0.88rem; color: #1e293b;" id="client-track-evento">-</strong>
                                </div>
                                <div class="col s12 m4 l3" style="margin-bottom: 12px;">
                                    <span style="font-size: 0.72rem; color: #64748b; display: block; font-weight: 600;">COMPAÑÍA ASEGURADORA</span>
                                    <strong style="font-size: 0.88rem; color: #1e293b;" id="client-track-aseguradora">Lorens Peritajes</strong>
                                </div>
                                <div class="col s12 m4 l3" style="margin-bottom: 12px;">
                                    <span style="font-size: 0.72rem; color: #64748b; display: block; font-weight: 600;">FECHA DEL EVENTO</span>
                                    <strong style="font-size: 0.88rem; color: #1e293b;" id="client-track-fecha-evento">-</strong>
                                </div>
                                <div class="col s12 m4 l3" style="margin-bottom: 12px;">
                                    <span style="font-size: 0.72rem; color: #64748b; display: block; font-weight: 600;">FECHA DE INSPECCIÓN</span>
                                    <strong style="font-size: 0.88rem; color: #1e293b;" id="client-track-fecha-visita">-</strong>
                                </div>
                                <div class="col s12 m4 l3" style="margin-bottom: 12px;">
                                    <span style="font-size: 0.72rem; color: #64748b; display: block; font-weight: 600;">ETAPA ACTUAL</span>
                                    <strong style="font-size: 0.88rem; color: #2563eb;" id="client-track-etapa-actual">-</strong>
                                </div>
                                <div class="col s12 m4 l3" style="margin-bottom: 12px;">
                                    <span style="font-size: 0.72rem; color: #64748b; display: block; font-weight: 600;">ESTADO GENERAL</span>
                                    <span class="client-stage-status-pill completada" id="client-track-estado-pill">Activo</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- BLOQUE CONDICIONAL 1: CUANDO EL EXPEDIENTE AÚN NO ALCANZA LA ETAPA EVIDENCIA -->
                    <div id="client-timeline-locked-view" class="client-locked-notice" style="display: none;">
                        <div class="lock-circle">
                            <i class="material-icons" style="font-size: 2.2rem;">lock</i>
                        </div>
                        <h5>SEGUIMIENTO DETALLADO EN PREPARACIÓN</h5>
                        <p>
                            <strong>El seguimiento detallado estará disponible cuando su expediente ingrese a la etapa de Evidencia.</strong>
                        </p>
                        <div style="margin-top: 14px;">
                            <span style="font-size: 0.78rem; color: #64748b;">
                                Etapa en curso: <strong id="client-locked-stage-name" style="color: #0284c7;">Visita Programada</strong>
                            </span>
                        </div>
                    </div>

                    <!-- BLOQUE CONDICIONAL 2: LÍNEA DE TIEMPO DEL EXPEDIENTE (HABILITADA A PARTIR DE EVIDENCIA) -->
                    <div id="client-timeline-unlocked-view" style="display: none;">
                        <div class="card" style="border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 4px 14px rgba(0,0,0,0.04); margin-bottom: 24px; padding: 20px 24px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
                                <div>
                                    <h5 style="margin: 0; font-weight: 800; font-size: 1.2rem; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                                        <i class="material-icons" style="color: #2563eb;">timeline</i> LÍNEA DE TIEMPO DEL EXPEDIENTE
                                    </h5>
                                    <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b;">
                                        Consulte las 9 etapas oficiales del proceso pericial y el estado real de cada hito.
                                    </p>
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px; font-size: 0.74rem;">
                                    <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block;"></span> Completada</span>
                                    <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #2563eb; display: inline-block;"></span> En curso</span>
                                    <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span> Observada</span>
                                    <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #cbd5e1; display: inline-block;"></span> Pendiente</span>
                                </div>
                            </div>

                            <!-- Árbol vertical de las 9 etapas -->
                            <div id="client-timeline-tree-container" class="client-timeline-tree">
                                <!-- Se llena dinámicamente con renderClientTimeline() -->
                            </div>
                        </div>

                        <!-- EVIDENCIAS FOTOGRÁFICAS PARA EL CLIENTE -->
                        <div class="card" style="border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 4px 14px rgba(0,0,0,0.04); margin-bottom: 30px; padding: 20px 24px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
                                <div>
                                    <h5 style="margin: 0; font-weight: 800; font-size: 1.2rem; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                                        <i class="material-icons" style="color: #10b981;">photo_library</i> EVIDENCIAS FOTOGRÁFICAS AUTORIZADAS
                                    </h5>
                                    <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b;">
                                        Registros fotográficos validados para consulta del asegurado en este expediente.
                                    </p>
                                </div>
                                <span class="badge-tag blue lighten-5 blue-text text-darken-3" style="font-weight: 700; font-size: 0.74rem; padding: 4px 10px; border-radius: 6px;" id="client-evidence-count-badge">
                                    0 fotografías
                                </span>
                            </div>

                            <div id="client-evidence-loading" class="center-align" style="padding: 30px 20px; display: none;">
                                <div class="preloader-wrapper small active">
                                    <div class="spinner-layer spinner-teal-only">
                                        <div class="circle-clipper left"><div class="circle"></div></div>
                                        <div class="gap-patch"><div class="circle"></div></div>
                                        <div class="circle-clipper right"><div class="circle"></div></div>
                                    </div>
                                </div>
                                <div style="margin-top: 6px; font-size: 0.8rem; color: #64748b;">Cargando evidencias fotográficas autorizadas...</div>
                            </div>

                            <div class="row" id="client-evidence-grid" style="margin-bottom: 0;">
                                <!-- Se llena dinámicamente -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="inspector-main-content" style="display: none;">`;

if (indexHtml.includes(inspectorContentAnchor) && !indexHtml.includes('id="client-main-content"')) {
  indexHtml = indexHtml.replace(inspectorContentAnchor, clientMainContentHtml);
  console.log('✓ Contenedor #client-main-content insertado.');
}

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log('✓ index.html actualizado con éxito.');

