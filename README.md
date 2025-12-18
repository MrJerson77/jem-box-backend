# 🚀 Jem Box Backend + Bot

Backend de Express y Bot de Telegram para la plataforma Jem Box.

## 🛠️ Tecnologías

- **Backend**: Express.js + Supabase
- **Bot**: Telegraf (Telegram Bot)
- **Deployment**: Railway

## 📋 Variables de Entorno Requeridas

```env
BOT_TOKEN=tu_token_de_telegram
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_key_de_supabase
PORT=3001
```

## 🚀 Deployment en Railway

1. Conecta este repositorio a Railway
2. Configura las variables de entorno
3. Railway ejecutará automáticamente `npm start`

## 📡 Endpoints del Backend

- `GET /` - Health check
- `POST /api/register` - Registro de usuarios
- `POST /api/login` - Login
- `POST /api/purchase` - Crear compra
- `GET /api/purchases/:username` - Obtener compras de usuario
- `GET /api/purchases` - Obtener todas las compras (admin)
- `POST /api/purchase/approve` - Aprobar compra
- `POST /api/purchase/reject` - Rechazar compra
- `DELETE /api/purchase/:id` - Cancelar compra

## 🤖 Comandos del Bot

- `/start` - Verificar registro
- `/aceptar_ID` - Aprobar compra (admin/seller)
- `/rechazar_ID` - Rechazar compra (admin/seller)
- `/cancelar` - Cancelar acción pendiente
- `/notify mensaje` - Notificación masiva (solo admin)

## 👨‍💻 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Crear archivo .env con las variables necesarias
cp .env.example .env

# Iniciar servicios
npm start
```

## 📞 Soporte

Contacto: @soyjemoox