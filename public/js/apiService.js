/**
 * Cliente API para ASESORÍAS LORENS
 *
 * Centraliza las llamadas al backend: adjunta el token JWT, normaliza los
 * errores con su código HTTP y notifica a la interfaz cuando la sesión caduca.
 */
const SESSION_EXPIRED_EVENT = 'lorens:session-expired';
const PRODUCTION_API_URL = 'https://asesorias-lorens.onrender.com/api';

const ApiService = {
  baseUrl: localStorage.getItem('lorens_api_url') || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000/api'
      : PRODUCTION_API_URL
  ),

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('lorens_token');
    const isFormData = options.body instanceof FormData;

    // Headers base: no forzar Content-Type en FormData para que el navegador fije el boundary multipart
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });
    } catch (networkError) {
      const error = new Error('No fue posible contactar el servidor PostgreSQL.');
      error.status = 0;
      error.cause = networkError;
      console.warn(`[ApiService] Sin conexión en ${endpoint}:`, networkError.message);
      throw error;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const error = new Error(errData.error || `Error HTTP: ${response.status}`);
      error.status = response.status;
      error.details = errData.details || null;

      // El login falla con 401 por credenciales, no por sesión caducada.
      const isLoginCall = endpoint.indexOf('/auth/login') !== -1;
      if (response.status === 401 && !isLoginCall) {
        this.clearAuth();
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { endpoint } }));
      }

      console.warn(`[ApiService] ${endpoint} respondió ${response.status}:`, error.message);
      throw error;
    }

    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  },

  // Autenticación y Perfiles RBAC
  setAuth(token, user) {
    if (token) localStorage.setItem('lorens_token', token);
    if (user) localStorage.setItem('lorens_user', JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem('lorens_token');
    localStorage.removeItem('lorens_user');
  },

  getUser() {
    try {
      const u = localStorage.getItem('lorens_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem('lorens_token');
  },

  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  // ==============================================================
  // EXPEDIENTES (100% DINÁMICOS DESDE POSTGRESQL)
  // ==============================================================
  async getCaseDetails(caseId) {
    return this.request(`/cases/${caseId}`);
  },

  async getAllCases() {
    return this.request('/cases');
  },

  async getAssignedCases(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.search) query.append('search', params.search);
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.dateFrom) query.append('dateFrom', params.dateFrom);
    if (params.dateTo) query.append('dateTo', params.dateTo);
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);

    const queryString = query.toString();
    const endpoint = `/cases/assigned${queryString ? `?${queryString}` : ''}`;
    return this.request(endpoint);
  },

  async getInspectorKpis() {
    return this.request('/cases/assigned/kpis');
  },

  async updateCaseStatus(caseId, estado) {
    return this.request(`/cases/${caseId}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado })
    });
  },

  async finalizeInspection(caseId) {
    return this.request(`/cases/${caseId}/finalize`, {
      method: 'PUT'
    });
  },

  async saveObservations(caseId, observationsData) {
    return this.request(`/cases/${caseId}/observations`, {
      method: 'PUT',
      body: JSON.stringify(observationsData)
    });
  },

  async getCaseStatuses() {
    return this.request('/cases/meta/estados');
  },

  async updateLiquidador(caseId, liquidadorId, liquidadorNombre) {
    return this.request(`/cases/${caseId}/liquidador`, {
      method: 'PUT',
      body: JSON.stringify({ liquidador_id: liquidadorId, liquidador_nombre: liquidadorNombre })
    });
  },

  // ==============================================================
  // SECTORES DEL INMUEBLE (POSTGRESQL)
  // ==============================================================
  async getSectors(caseId) {
    return this.request(`/cases/${caseId}/sectors`);
  },

  async createSector(caseId, sectorData) {
    return this.request(`/cases/${caseId}/sectors`, {
      method: 'POST',
      body: JSON.stringify(sectorData)
    });
  },

  async deleteSector(caseId, sectorId) {
    return this.request(`/cases/${caseId}/sectors/${sectorId}`, {
      method: 'DELETE'
    });
  },

  // ==============================================================
  // PARTIDAS DE DAÑO (CUBICACIÓN REAL EN POSTGRESQL)
  // ==============================================================
  async addLine(caseId, lineData) {
    return this.request(`/cases/${caseId}/lines`, {
      method: 'POST',
      body: JSON.stringify(lineData)
    });
  },

  async deleteLine(lineId) {
    return this.request(`/cases/lines/${lineId}`, {
      method: 'DELETE'
    });
  },

  // ==============================================================
  // EVIDENCIAS FOTOGRÁFICAS (ALMACENAMIENTO FÍSICO + POSTGRESQL + TIMELINE)
  // ==============================================================
  async uploadPhoto(caseId, formData) {
    return this.request(`/cases/${caseId}/photos/upload`, {
      method: 'POST',
      body: formData // Multer multipart/form-data
    });
  },

  // Carga con barra de progreso real (0-100% transfer)
  uploadPhotoWithProgress(caseId, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const token = this.getToken();
      const url = `${this.baseUrl}/cases/${caseId}/photos/upload`;

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress({ stage: 'uploading', percent, loaded: event.loaded, total: event.total });
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (e) {
            resolve({ ok: true });
          }
        } else {
          let errMessage = 'No fue posible guardar la fotografía en el servidor.';
          try {
            const errData = JSON.parse(xhr.responseText);
            errMessage = errData.error || errMessage;
          } catch (e) {}
          const err = new Error(errMessage);
          err.status = xhr.status;
          reject(err);
        }
      };

      xhr.onerror = () => reject(new Error('Error de conexión al transferir la fotografía.'));
      xhr.ontimeout = () => reject(new Error('Tiempo de espera agotado al subir el archivo.'));

      xhr.open('POST', url, true);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  },

  async getPhotos(caseId) {
    return this.request(`/cases/${caseId}/photos`);
  },

  async deletePhoto(caseId, photoId) {
    return this.request(`/cases/${caseId}/photos/${photoId}`, {
      method: 'DELETE'
    });
  },

  async getPhotoTimeline(caseId, photoId) {
    return this.request(`/cases/${caseId}/photos/${photoId}/timeline`);
  },

  async addPhotoTimelineEvent(caseId, photoId, eventData) {
    return this.request(`/cases/${caseId}/photos/${photoId}/timeline`, {
      method: 'POST',
      body: JSON.stringify(eventData)
    });
  },

  async fetchPhotoBlob(caseId, photoId) {
    const token = this.getToken();
    const endpoint = `${this.baseUrl}/cases/${caseId}/photos/${photoId}/file`;
    const res = await fetch(endpoint, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status} al recuperar imagen.`);
    }
    return res.blob();
  },

  // ==============================================================
  // PORTAL DEL CLIENTE (ASEGURADOS)
  // ==============================================================
  async clientLogin(email, password) {
    return this.request('/client/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async getClientProfile() {
    return this.request('/client/me');
  },

  async getClientCases() {
    return this.request('/client/cases');
  },

  async getClientCaseDetail(caseId) {
    return this.request(`/client/cases/${caseId}`);
  },

  async getClientCaseTimeline(caseId) {
    return this.request(`/client/cases/${caseId}/timeline`);
  },

  async getClientCaseEvidence(caseId) {
    return this.request(`/client/cases/${caseId}/evidence`);
  },

  async fetchClientPhotoBlob(caseId, photoId) {
    const token = this.getToken();
    const endpoint = `${this.baseUrl}/client/cases/${caseId}/photos/${photoId}/file`;
    const res = await fetch(endpoint, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status} al recuperar evidencia autorizada.`);
    }
    return res.blob();
  },

  // ==============================================================
  // SNAPSHOTS & AUDITORÍA
  // ==============================================================
  async createSnapshot(caseId, supervisorAprobador) {
    return this.request(`/cases/${caseId}/snapshots`, {
      method: 'POST',
      body: JSON.stringify({ supervisor_aprobador: supervisorAprobador })
    });
  },

  async getSnapshots(caseId) {
    return this.request(`/cases/${caseId}/snapshots`);
  },

  // ==============================================================
  // MÓDULO AJUSTADOR (CUANTIFICACIÓN Y PRESUPUESTOS)
  // ==============================================================
  async getAdjusterDashboard() {
    return this.request('/adjuster/dashboard');
  },

  async getAdjusterCases(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/adjuster/cases${qs ? '?' + qs : ''}`);
  },

  async getAdjusterCase(caseId) {
    return this.request(`/adjuster/cases/${caseId}`);
  },

  async getAdjusterCatalogProcesses() {
    return this.request('/adjuster/catalog/processes');
  },

  async addAdjusterBudgetItem(caseId, itemData) {
    return this.request(`/adjuster/cases/${caseId}/items`, {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  },

  async updateAdjusterBudgetItem(itemId, itemData) {
    return this.request(`/adjuster/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(itemData)
    });
  },

  async deleteAdjusterBudgetItem(itemId) {
    return this.request(`/adjuster/items/${itemId}`, {
      method: 'DELETE'
    });
  },

  async saveAdjusterDraft(caseId, data = {}) {
    return this.request(`/adjuster/cases/${caseId}/save-draft`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async submitAdjusterReview(caseId) {
    return this.request(`/adjuster/cases/${caseId}/submit-review`, {
      method: 'POST'
    });
  },

  async approveAdjusterBudget(caseId, data = {}) {
    return this.request(`/adjuster/cases/${caseId}/approve`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async observeAdjusterBudget(caseId, observacion) {
    return this.request(`/adjuster/cases/${caseId}/observe`, {
      method: 'POST',
      body: JSON.stringify({ observacion })
    });
  },

  async downloadAdjusterExcel(caseId, caseCode) {
    const token = this.getToken();
    const endpoint = `${this.baseUrl}/adjuster/cases/${caseId}/export/excel?token=${encodeURIComponent(token || '')}`;
    const res = await fetch(endpoint, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status} al descargar presupuesto Excel.`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Presupuesto_${caseCode || 'Siniestro'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  async downloadAdjusterPdf(caseId, caseCode) {
    const token = this.getToken();
    const endpoint = `${this.baseUrl}/adjuster/cases/${caseId}/export/pdf?token=${encodeURIComponent(token || '')}`;
    const res = await fetch(endpoint, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status} al generar informe PDF.`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Presupuesto_Pericial_${caseCode || 'Siniestro'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // Catálogos
  async getLiquidadores() {
    return this.request('/liquidadores');
  },

  async getProcesos() {
    return this.request('/procesos');
  },

  // Administración Webmaster
  async getUsers() {
    return this.request('/users');
  },

  async getSystemStatus() {
    return this.request('/system/status');
  },

  async getAuditLogs() {
    return this.request('/system/audit');
  }
};

window.ApiService = ApiService;
window.LORENS_SESSION_EXPIRED_EVENT = SESSION_EXPIRED_EVENT;
