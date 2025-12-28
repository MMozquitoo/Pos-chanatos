import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { waiterOrdersApi } from '../../services/api';
import type { Order } from '../../types';
import '../../styles/MeseroPedidos.css';

const MeseroPedidos = () => {
  const { logout } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderIdParam = searchParams.get('orderId');
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'LISTO'>('ALL');
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({
    productName: '',
    quantity: 1,
    price: 0,
    notes: '',
  });

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  useEffect(() => {
    if (orderIdParam && orders.length > 0) {
      const order = orders.find(o => o.id === orderIdParam);
      if (order) setSelectedOrder(order);
    }
  }, [orderIdParam, orders]);

  const loadOrders = async () => {
    try {
      const params = filter === 'LISTO' ? { readyOnly: true } : {};
      const res = await waiterOrdersApi.list(params);
      setOrders(res.data);
      if (selectedOrder) {
        const updated = res.data.find(o => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!selectedOrder || !newItem.productName || newItem.price <= 0) return;

    try {
      await waiterOrdersApi.addItems(selectedOrder.id, [{
        productName: newItem.productName,
        quantity: newItem.quantity,
        price: newItem.price,
        notes: newItem.notes || undefined,
      }]);
      setNewItem({ productName: '', quantity: 1, price: 0, notes: '' });
      await loadOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al agregar item');
    }
  };

  const handleDeliver = async (orderId: string) => {
    try {
      await waiterOrdersApi.deliver(orderId);
      await loadOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al marcar como entregado');
    }
  };

  const handleRequestBill = async (orderId: string) => {
    try {
      await waiterOrdersApi.requestBill(orderId);
      await loadOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al solicitar cuenta');
    }
  };

  if (loading) {
    return <div className="mesero-pedidos-container">Cargando...</div>;
  }

  return (
    <div className="mesero-pedidos-container">
      <header>
        <button onClick={() => navigate('/mesero')} className="btn-back">← Volver</button>
        <h1>Pedidos</h1>
        <button onClick={logout} className="btn-secondary">Salir</button>
      </header>

      <div className="filters">
        <button
          className={filter === 'ALL' ? 'active' : ''}
          onClick={() => setFilter('ALL')}
        >
          Todos
        </button>
        <button
          className={filter === 'LISTO' ? 'active' : ''}
          onClick={() => setFilter('LISTO')}
        >
          Listos para entregar
        </button>
      </div>

      <div className="pedidos-content">
        <div className="orders-list">
          {orders.map((order) => (
            <div
              key={order.id}
              className={`order-card ${selectedOrder?.id === order.id ? 'selected' : ''}`}
              onClick={() => setSelectedOrder(order)}
            >
              <div className="order-header">
                <span>#{order.id.slice(-6)}</span>
                <span className={`status ${order.status.toLowerCase()}`}>
                  {order.status}
                </span>
              </div>
              {order.table && <div>Mesa: {order.table.number}</div>}
              <div>Canal: {order.channel}</div>
              {order.status === 'LISTO' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeliver(order.id);
                  }}
                  className="btn-deliver"
                >
                  Entregar
                </button>
              )}
            </div>
          ))}
        </div>

        {selectedOrder && (
          <div className="order-details">
            <h2>Pedido #{selectedOrder.id.slice(-6)}</h2>
            <div className="info">
              <div>Canal: {selectedOrder.channel}</div>
              {selectedOrder.table && <div>Mesa: {selectedOrder.table.number}</div>}
              <div>Estado: {selectedOrder.status}</div>
              <div>Total: ${selectedOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}</div>
            </div>

            <div className="items-section">
              <h3>Items</h3>
              {selectedOrder.items.map((item) => (
                <div key={item.id} className="item-row">
                  <span>{item.productName} x{item.quantity}</span>
                  <span>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {!selectedOrder.paidAt && (
              <>
                <div className="add-item-section">
                  <h3>Agregar item</h3>
                  <input
                    type="text"
                    placeholder="Producto"
                    value={newItem.productName}
                    onChange={(e) => setNewItem({ ...newItem, productName: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="Cantidad"
                    min="1"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Precio"
                    min="0"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                  />
                  <button onClick={handleAddItem} className="btn-add">Agregar</button>
                </div>

                <div className="actions">
                  {!selectedOrder.requestedBill && (
                    <button
                      onClick={() => handleRequestBill(selectedOrder.id)}
                      className="btn-primary"
                    >
                      Solicitar cuenta
                    </button>
                  )}
                  {selectedOrder.requestedBill && (
                    <div className="bill-requested">Cuenta solicitada</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeseroPedidos;

