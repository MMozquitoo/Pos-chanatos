import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cajaOrdersApi, paymentsApi } from '../../services/api';
import type { Order, PaymentMethod } from '../../types';
import '../../styles/CajaCobro.css';

const CajaCobro = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('EFECTIVO');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const [orderRes, summaryRes] = await Promise.all([
        cajaOrdersApi.getById(orderId!),
        paymentsApi.getSummary(orderId!),
      ]);
      setOrder(orderRes.data);
      setPaymentSummary(summaryRes.data);
    } catch (err) {
      console.error('Error loading order:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!orderId || !amount || parseFloat(amount) <= 0) return;

    setProcessing(true);
    try {
      await paymentsApi.create({
        orderId,
        method,
        amount: parseFloat(amount),
      });
      setAmount('');
      await loadOrder(); // Recargar para ver si se marcó como pagado
      
      if (paymentSummary && parseFloat(amount) >= paymentSummary.remaining) {
        setTimeout(() => {
          navigate('/caja');
        }, 1000);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al registrar pago');
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !order || !paymentSummary) {
    return <div className="caja-cobro-container">Cargando...</div>;
  }

  const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const remaining = paymentSummary.remaining;

  return (
    <div className="caja-cobro-container">
      <header>
        <button onClick={() => navigate('/caja')} className="btn-back">← Volver</button>
        <h1>Cobro - Pedido #{order.id.slice(-6)}</h1>
      </header>

      <div className="cobro-content">
        <div className="order-details">
          <h2>Detalles del pedido</h2>
          <div className="info-row">
            <span>Canal:</span>
            <span>{order.channel}</span>
          </div>
          {order.table && (
            <div className="info-row">
              <span>Mesa:</span>
              <span>{order.table.number}</span>
            </div>
          )}
          <div className="info-row">
            <span>Estado:</span>
            <span>{order.status}</span>
          </div>
          <div className="items-list">
            <h3>Items:</h3>
            {order.items.map((item) => (
              <div key={item.id} className="item-row">
                <span>{item.productName} x{item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="total-row">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div className="paid-row">
            <span>Pagado:</span>
            <span>${paymentSummary.paidTotal.toFixed(2)}</span>
          </div>
          <div className="remaining-row">
            <span>Pendiente:</span>
            <span>${remaining.toFixed(2)}</span>
          </div>
        </div>

        <div className="payment-section">
          <h2>Registrar pago</h2>
          <div className="form-group">
            <label>Método de pago</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div className="form-group">
            <label>Monto</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Máximo: $${remaining.toFixed(2)}`}
            />
          </div>
          <button
            onClick={handlePayment}
            disabled={!amount || parseFloat(amount) <= 0 || processing}
            className="btn-primary"
          >
            {processing ? 'Procesando...' : 'Registrar pago'}
          </button>
          {paymentSummary.isPaid && (
            <div className="paid-message">
              ✓ Pedido completamente pagado
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CajaCobro;

