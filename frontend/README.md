# POS Chanatos - Frontend V1

Frontend PWA/Web para el sistema POS Chanatos.

## Características

- ✅ Login y routing por rol
- ✅ UI CAJA (desktop): pedidos, cobro, sesión de caja
- ✅ UI MESERO (mobile-first): mesas, crear pedidos, agregar items, entregar
- ✅ UI COCINA (tablet): cola de pedidos, botones de estado
- ✅ Polling automático para refrescar colas (4-5s)
- ✅ Route guards por rol

## Instalación

```bash
cd frontend
npm install
```

## Desarrollo

```bash
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

## Estructura

```
src/
├── components/        # Componentes reutilizables
├── context/           # Context API (Auth)
├── pages/             # Páginas por rol
│   ├── Login.tsx
│   ├── caja/
│   ├── mesero/
│   └── cocina/
├── services/          # API calls
├── styles/            # CSS por módulo
├── types/             # TypeScript types
└── App.tsx            # Router principal
```

## Rutas

- `/login` - Login
- `/caja` - Dashboard CAJA
- `/caja/cobro/:orderId` - Pantalla de cobro
- `/caja/sesion` - Gestión de sesión de caja
- `/mesero` - Grid de mesas
- `/mesero/crear` - Crear pedido
- `/mesero/pedidos` - Lista de pedidos
- `/cocina` - Cola de cocina

## Notas

- El backend debe estar corriendo en `http://localhost:3000`
- El proxy está configurado en `vite.config.ts`
- Polling configurado: 4-5 segundos según la pantalla
- No se muestran precios en la UI de COCINA

