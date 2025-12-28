import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cashApi } from '../../services/api';
import type { CashSession } from '../../types';
import '../../styles/CajaSesion.css';

const CajaSesion = () => {
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [initialCash, setInitialCash] = useState('');
  const [finalCash, setFinalCash] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const res = await cashApi.getActive().catch(() => null);
      setActiveSession(res?.data || null);
    } catch (err) {
      console.error('Error loading session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = async () => {
    if (!initialCash || parseFloat(initialCash) < 0) return;

    setProcessing(true);
    try {
      await cashApi.openSession({
        initialCash: parseFloat(initialCash),
      });
      setInitialCash('');
      await loadSession();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al abrir sesión');
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession || !finalCash || parseFloat(finalCash) < 0) return;

    setProcessing(true);
    try {
      await cashApi.closeSession(activeSession.id, {
        finalCash: parseFloat(finalCash),
      });
      setFinalCash('');
      await loadSession();
      navigate('/caja');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al cerrar sesión');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="caja-sesion-container">Cargando...</div>;
  }

  return (
    <div className="caja-sesion-container">
      <header>
        <button onClick={() => navigate('/caja')} className="btn-back">← Volver</button>
        <h1>Gestión de Caja</h1>
      </header>

      <div className="sesion-content">
        {activeSession ? (
          <div className="session-active">
            <h2>Sesión abierta</h2>
            <div className="session-info">
              <div className="info-row">
                <span>Abierta:</span>
                <span>{new Date(activeSession.openedAt).toLocaleString()}</span>
              </div>
              <div className="info-row">
                <span>Efectivo inicial:</span>
                <span>${activeSession.initialCash.toFixed(2)}</span>
              </div>
            </div>
            <div className="close-section">
              <h3>Cerrar sesión</h3>
              <div className="form-group">
                <label>Efectivo final</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={finalCash}
                  onChange={(e) => setFinalCash(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <button
                onClick={handleCloseSession}
                disabled={!finalCash || processing}
                className="btn-danger"
              >
                {processing ? 'Cerrando...' : 'Cerrar sesión'}
              </button>
            </div>
          </div>
        ) : (
          <div className="session-closed">
            <h2>Abrir nueva sesión</h2>
            <div className="form-group">
              <label>Efectivo inicial</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <button
              onClick={handleOpenSession}
              disabled={!initialCash || processing}
              className="btn-primary"
            >
              {processing ? 'Abriendo...' : 'Abrir sesión'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CajaSesion;

