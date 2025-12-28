import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cajaOrdersApi, cashApi } from '../../services/api';
import type { Order, CashSession } from '../../types';
import '../../styles/Caja.css';

const CajaDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'MESA' | 'VENTANILLA' | 'DOMICILIO'>('ALL');
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Polling cada 5s
    return () => clearInterval(interval);
  }, [filter]);

  const loadData = async () => {
    try {
      const params = filter === 'ALL' ? {} : { channel: filter };
      const [ordersRes, pendingRes, sessionRes] = await Promise.all([
        cajaOrdersApi.list(params),
        cajaOrdersApi.list({ requestedBill: true }),
        cashApi.getActive().catch(() => ({ data: null })),
      ]);
      
      setOrders(ordersRes.data);
      setPendingOrders(pendingRes.data.filter((o: Order) => !o.paidAt));
      setActiveSession(sessionRes?.data || null);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCobrar = (orderId: string) => {
    navigate(`/caja/cobro/${orderId}`);
  };

  if (loading) {
    return <div className="caja-container">Cargando...</div>;
  }

  return (
    <div className="caja-container">
      <header className="caja-header">
        <div>
          <h1>Caja - {user?.name}</h1>
          {activeSession ? (
            <span className="session-badge active">Sesión abierta</span>
          ) : (
            <span className="session-badge inactive">Sesión cerrada</span>
          )}
        </div>
        <div>
          <button onClick={() => navigate('/caja/sesion')} className="btn-secondary">
            {activeSession ? 'Ver Sesión' : 'Abrir Sesión'}
          </button>
          <button onClick={logout} className="btn-secondary">Salir</button>
        </div>
      </header>

      <div className="caja-content">
        <div className="filters">
          <button
            className={filter === 'ALL' ? 'active' : ''}
            onClick={() => setFilter('ALL')}
          >
            Todos
          </button>
          <button
            className={filter === 'MESA' ? 'active' : ''}
            onClick={() => setFilter('MESA')}
          >
            Mesas
          </button>
          <button
            className={filter === 'VENTANILLA' ? 'active' : ''}
            onClick={() => setFilter('VENTANILLA')}
          >
            Ventanilla
          </button>
          <button
            className={filter === 'DOMICILIO' ? 'active' : ''}
            onClick={() => setFilter('DOMICILIO')}
          >
            Domicilios
          </button>
        </div>

        <div className="pending-section">
          <h2>Pendientes por cobrar ({pendingOrders.length})</h2>
          <div className="orders-grid">
            {pendingOrders.map((order) => (
              <div key={order.id} className="order-card pending">
                <div className="order-header">
                  <span>#{order.id.slice(-6)}</span>
                  <span className="status">{order.status}</span>
                </div>
                <div className="order-info">
                  {order.table && <div>Mesa: {order.table.number}</div>}
                  <div>Canal: {order.channel}</div>
                  <div className="total">
                    Total: ${order.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}
                  </div>
                </div>
                <button onClick={() => handleCobrar(order.id)} className="btn-primary">
                  Cobrar
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="all-orders-section">
          <h2>Todos los pedidos</h2>
          <div className="orders-list">
            {orders.map((order) => (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <span>#{order.id.slice(-6)}</span>
                  <span className={`status ${order.status.toLowerCase()}`}>
                    {order.status}
                  </span>
                  {order.paidAt && <span className="paid-badge">Pagado</span>}
                </div>
                <div className="order-info">
                  {order.table && <div>Mesa: {order.table.number}</div>}
                  <div>Canal: {order.channel}</div>
                  <div>Total: ${order.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}</div>
                </div>
                {!order.paidAt && order.requestedBill && (
                  <button onClick={() => handleCobrar(order.id)} className="btn-primary">
                    Cobrar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CajaDashboard;

