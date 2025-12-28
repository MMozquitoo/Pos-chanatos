import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tablesApi } from '../../services/api';
import type { Table } from '../../types';
import '../../styles/Mesero.css';

const MeseroMesas = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTables();
    const interval = setInterval(loadTables, 5000); // Polling cada 5s
    return () => clearInterval(interval);
  }, []);

  const loadTables = async () => {
    try {
      const res = await tablesApi.getTables();
      setTables(res.data);
    } catch (err) {
      console.error('Error loading tables:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTableClick = (table: Table) => {
    if (table.is_occupied && table.active_order_id) {
      navigate(`/mesero/pedidos?orderId=${table.active_order_id}`);
    } else {
      navigate(`/mesero/crear?tableId=${table.id}&channel=MESA`);
    }
  };

  if (loading) {
    return <div className="mesero-container">Cargando...</div>;
  }

  return (
    <div className="mesero-container">
      <header className="mesero-header">
        <h1>Mesas - {user?.name}</h1>
        <div>
          <button onClick={() => navigate('/mesero/pedidos')} className="btn-secondary">
            Ver Pedidos
          </button>
          <button onClick={logout} className="btn-secondary">Salir</button>
        </div>
      </header>

      <div className="tables-grid">
        {tables.map((table) => (
          <div
            key={table.id}
            className={`table-card ${table.is_occupied ? 'occupied' : 'free'}`}
            onClick={() => handleTableClick(table)}
          >
            <div className="table-header">
              <h2>{table.label}</h2>
              {table.zone && <span className="zone">{table.zone}</span>}
            </div>
            {table.is_occupied ? (
              <div className="table-status">
                <div className="status-badge occupied">Ocupada</div>
                {table.active_order_status && (
                  <div className="order-status">{table.active_order_status}</div>
                )}
                {table.requested_bill && (
                  <div className="bill-requested">Cuenta solicitada</div>
                )}
              </div>
            ) : (
              <div className="status-badge free">Libre</div>
            )}
          </div>
        ))}
      </div>

      <div className="floating-actions">
        <button
          onClick={() => navigate('/mesero/crear?channel=VENTANILLA')}
          className="fab"
        >
          + Ventanilla
        </button>
        <button
          onClick={() => navigate('/mesero/crear?channel=DOMICILIO')}
          className="fab"
        >
          + Domicilio
        </button>
      </div>
    </div>
  );
};

export default MeseroMesas;

