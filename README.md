# POS Chanatos - Backend V1

Sistema POS centralizado para restaurantes. Backend base con autenticación, roles y permisos.

## Características

- ✅ Autenticación JWT
- ✅ Sistema de roles (CAJA, MESERO, COCINA)
- ✅ Permisos granulares por rol
- ✅ Modelo de base de datos completo (Prisma)
- ✅ Validación de transiciones de estado
- ✅ Auditoría integrada

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- npm o yarn

## Instalación

1. Clonar el repositorio
2. Instalar dependencias:

```bash
npm install
```

3. Configurar variables de entorno:

```bash
cp .env.example .env
```

Editar `.env` y configurar:

- `DATABASE_URL`: URL de conexión con pooling (Supabase: puerto 6543 con pgbouncer)
- `DIRECT_URL`: URL de conexión directa para migraciones (Supabase: puerto 5432)
- `JWT_SECRET`: Clave secreta para JWT (cambiar en producción)
- `PORT`: Puerto del servidor (default: 3000)

**Nota para Supabase**:

- `DATABASE_URL` usa connection pooling (puerto 6543) para mejor performance
- `DIRECT_URL` usa conexión directa (puerto 5432) requerida por Prisma para migraciones

4. Generar cliente de Prisma:

```bash
npm run db:generate
```

5. Crear base de datos y aplicar migraciones:

```bash
npm run db:push
```

6. Poblar base de datos con datos iniciales:

```bash
npm run db:seed
```

Esto creará:

- Los 3 roles del sistema (CAJA, MESERO, COCINA)
- Un usuario administrador por defecto:
  - Email: `admin@chanatos.com`
  - Password: `admin123`
  - **⚠️ Cambiar esta contraseña en producción**

## Desarrollo

Ejecutar en modo desarrollo:

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## Estructura del Proyecto

```
src/
├── config/          # Configuración (DB, env)
├── controllers/     # Controladores de rutas
├── middleware/      # Middleware (auth, permissions)
├── routes/          # Definición de rutas
├── services/        # Lógica de negocio
├── types/           # Tipos TypeScript
└── server.ts        # Punto de entrada
```

## API Endpoints

### Autenticación

- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario (requiere CAJA)
- `GET /api/auth/me` - Obtener perfil del usuario autenticado

### Health Check

- `GET /api/health` - Estado del servidor

## Roles y Permisos

### CAJA

- Control total del sistema
- Puede crear, editar, cancelar pedidos
- Puede cobrar y marcar pagos
- Puede abrir/cerrar caja
- Ve todos los reportes

### MESERO

- Puede crear pedidos
- Puede agregar items a pedidos
- Puede cambiar estado LISTO → ENTREGADO
- Puede solicitar cuenta
- **NO puede** editar/eliminar items
- **NO puede** cancelar pedidos
- **NO puede** cobrar

### COCINA

- Puede ver pedidos y notas
- Puede cambiar estados:
  - RECIBIDO → PREPARACION
  - PREPARACION → LISTO
- **NO puede** ver precios
- **NO puede** editar pedidos
- **NO puede** cancelar pedidos

## Estados del Pedido

Máquina de estados válida:

- `RECIBIDO` → `PREPARACION` → `LISTO` → `ENTREGADO`
- Desde cualquier estado (excepto ENTREGADO): → `CANCELADO` (solo CAJA)

El pago se maneja con el flag `paid_at`, no es un estado.

## Base de Datos

### Comandos útiles

- Ver base de datos en Prisma Studio:

```bash
npm run db:studio
```

- Crear migración:

```bash
npm run db:migrate
```

- Aplicar cambios al schema:

```bash
npm run db:push
```

## Próximos Pasos

- [ ] Endpoints de órdenes
- [ ] Endpoints de mesas
- [ ] Endpoints de pagos
- [ ] Endpoints de caja
- [ ] Sistema de auditoría
- [ ] Validación de reglas de negocio

## Notas

- Este es el backend base (Paso 1)
- Seguir las reglas en `RULES.md`
- Consultar `SPEC.md` para detalles funcionales
- No agregar funcionalidades fuera de V1
