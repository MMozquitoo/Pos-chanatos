import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { kitchenApi } from '../../services/api';
import type { KitchenOrder } from '../../types';
import '../../styles/Cocina.css';

const CocinaQueue = () => {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 4000); // Polling cada 4s
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    try {
      const res = await kitchenApi.getQueue();
      setOrders(res.data);
    } catch (err) {
      console.error('Error loading queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (orderId: string) => {
    setProcessing(orderId);
    try {
      await kitchenApi.startPreparation(orderId);
      await loadQueue();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al iniciar preparación');
    } finally {
      setProcessing(null);
    }
  };

  const handleReady = async (orderId: string) => {
    setProcessing(orderId);
    try {
      await kitchenApi.markReady(orderId);
      await loadQueue();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al marcar como listo');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return <div className="cocina-container">Cargando...</div>;
  }

  return (
    <div className="cocina-container">
      <header className="cocina-header">
        <h1>Cocina - {user?.name}</h1>
        <button onClick={logout} className="btn-secondary">Salir</button>
      </header>

      <div className="queue-section">
        <h2>Cola de pedidos ({orders.length})</h2>
        <div className="orders-queue">
          {orders.length === 0 ? (
            <div className="empty-queue">No hay pedidos en cola</div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className={`order-card ${order.status.toLowerCase()}`}
              >
                <div className="order-header">
                  <span className="order-id">#{order.id.slice(-6)}</span>
                  <span className={`status-badge ${order.status.toLowerCase()}`}>
                    {order.status}
                  </span>
                </div>
                {order.table && (
                  <div className="table-info">Mesa {order.table.number}</div>
                )}
                <div className="channel-info">{order.channel}</div>
                {order.notes && (
                  <div className="order-notes">Nota: {order.notes}</div>
                )}

                <div className="items-list">
                  {order.items.map((item) => (
                    <div key={item.id} className="item-row">
                      <span className="item-name">
                        {item.productName} x{item.quantity}
                      </span>
                      {item.notes && (
                        <span className="item-notes">{item.notes}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="order-actions">
                  {order.status === 'RECIBIDO' && (
                    <button
                      onClick={() => handleStart(order.id)}
                      disabled={processing === order.id}
                      className="btn-start"
                    >
                      {processing === order.id ? 'Procesando...' : 'En preparación'}
                    </button>
                  )}
                  {order.status === 'PREPARACION' && (
                    <button
                      onClick={() => handleReady(order.id)}
                      disabled={processing === order.id}
                      className="btn-ready"
                    >
                      {processing === order.id ? 'Procesando...' : 'Listo'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CocinaQueue;

