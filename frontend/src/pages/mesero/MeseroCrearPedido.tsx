import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { waiterOrdersApi, tablesApi } from '../../services/api';
import type { Table, OrderItem, ChannelType } from '../../types';
import '../../styles/MeseroCrearPedido.css';

const MeseroCrearPedido = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const channel = (searchParams.get('channel') || 'MESA') as ChannelType;
  const tableId = searchParams.get('tableId') || '';
  
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState(tableId);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [currentItem, setCurrentItem] = useState({
    productName: '',
    quantity: 1,
    price: 0,
    notes: '',
  });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (channel === 'MESA') {
      loadTables();
    }
  }, [channel]);

  const loadTables = async () => {
    try {
      const res = await tablesApi.getTables();
      setTables(res.data.filter(t => !t.is_occupied));
    } catch (err) {
      console.error('Error loading tables:', err);
    }
  };

  const addItem = () => {
    if (!currentItem.productName || currentItem.price <= 0) return;
    
    setItems([...items, {
      id: Date.now().toString(),
      ...currentItem,
    }]);
    setCurrentItem({
      productName: '',
      quantity: 1,
      price: 0,
      notes: '',
    });
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      alert('Debe agregar al menos un item');
      return;
    }

    if (channel === 'MESA' && !selectedTableId) {
      alert('Debe seleccionar una mesa');
      return;
    }

    setLoading(true);
    try {
      await waiterOrdersApi.create({
        channel,
        tableId: channel === 'MESA' ? selectedTableId : undefined,
        notes,
        items: items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes || undefined,
        })),
      });
      navigate('/mesero');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al crear pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="crear-pedido-container">
      <header>
        <button onClick={() => navigate('/mesero')} className="btn-back">← Volver</button>
        <h1>Crear Pedido - {channel}</h1>
      </header>

      <div className="crear-pedido-content">
        {channel === 'MESA' && (
          <div className="form-section">
            <label>Mesa</label>
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
            >
              <option value="">Seleccionar mesa</option>
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.label} {table.zone && `- ${table.zone}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-section">
          <label>Notas del pedido</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas generales..."
          />
        </div>

        <div className="items-section">
          <h2>Items</h2>
          <div className="add-item-form">
            <input
              type="text"
              placeholder="Producto"
              value={currentItem.productName}
              onChange={(e) => setCurrentItem({ ...currentItem, productName: e.target.value })}
            />
            <input
              type="number"
              placeholder="Cantidad"
              min="1"
              value={currentItem.quantity}
              onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) || 1 })}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Precio"
              min="0"
              value={currentItem.price}
              onChange={(e) => setCurrentItem({ ...currentItem, price: parseFloat(e.target.value) || 0 })}
            />
            <input
              type="text"
              placeholder="Notas (opcional)"
              value={currentItem.notes}
              onChange={(e) => setCurrentItem({ ...currentItem, notes: e.target.value })}
            />
            <button onClick={addItem} className="btn-add">Agregar</button>
          </div>

          <div className="items-list">
            {items.map((item, index) => (
              <div key={item.id} className="item-row">
                <span>{item.productName} x{item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
                <button onClick={() => removeItem(index)} className="btn-remove">×</button>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || items.length === 0}
          className="btn-primary"
        >
          {loading ? 'Creando...' : 'Crear Pedido'}
        </button>
      </div>
    </div>
  );
};

export default MeseroCrearPedido;

