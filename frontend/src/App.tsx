import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import CajaDashboard from './pages/caja/CajaDashboard';
import CajaCobro from './pages/caja/CajaCobro';
import CajaSesion from './pages/caja/CajaSesion';
import MeseroMesas from './pages/mesero/MeseroMesas';
import MeseroCrearPedido from './pages/mesero/MeseroCrearPedido';
import MeseroPedidos from './pages/mesero/MeseroPedidos';
import CocinaQueue from './pages/cocina/CocinaQueue';
import { ProtectedRoute } from './components/ProtectedRoute';

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/caja"
        element={
          <ProtectedRoute allowedRoles={['CAJA']}>
            <CajaDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/caja/cobro/:orderId"
        element={
          <ProtectedRoute allowedRoles={['CAJA']}>
            <CajaCobro />
          </ProtectedRoute>
        }
      />
      <Route
        path="/caja/sesion"
        element={
          <ProtectedRoute allowedRoles={['CAJA']}>
            <CajaSesion />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mesero"
        element={
          <ProtectedRoute allowedRoles={['MESERO']}>
            <MeseroMesas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mesero/crear"
        element={
          <ProtectedRoute allowedRoles={['MESERO']}>
            <MeseroCrearPedido />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mesero/pedidos"
        element={
          <ProtectedRoute allowedRoles={['MESERO']}>
            <MeseroPedidos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cocina"
        element={
          <ProtectedRoute allowedRoles={['COCINA']}>
            <CocinaQueue />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          user ? (
            user.role === 'CAJA' ? (
              <Navigate to="/caja" replace />
            ) : user.role === 'MESERO' ? (
              <Navigate to="/mesero" replace />
            ) : (
              <Navigate to="/cocina" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

