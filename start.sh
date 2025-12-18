#!/bin/bash

echo "🚀 Iniciando Backend y Bot de Jem Box..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar variables de entorno
if [ -z "$BOT_TOKEN" ]; then
    echo "❌ ERROR: BOT_TOKEN no configurado"
    exit 1
fi

if [ -z "$SUPABASE_URL" ]; then
    echo "❌ ERROR: SUPABASE_URL no configurado"
    exit 1
fi

echo "✅ Variables de entorno verificadas"
echo ""

# Iniciar backend en segundo plano
echo "📡 Iniciando Backend (Express)..."
cd backend
node server.js &
BACKEND_PID=$!
echo "✅ Backend iniciado (PID: $BACKEND_PID) - Puerto: ${PORT:-3001}"
cd ..

# Esperar 2 segundos
sleep 2

# Iniciar bot en segundo plano
echo "🤖 Iniciando Bot de Telegram..."
cd bot
node bot.js &
BOT_PID=$!
echo "✅ Bot iniciado (PID: $BOT_PID)"
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Jem Box Backend activo"
echo "📡 Backend: http://localhost:${PORT:-3001}"
echo "🤖 Bot: Polling activo"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Función para manejar señales de terminación
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    kill $BACKEND_PID $BOT_PID 2>/dev/null
    echo "✅ Servicios detenidos"
    exit 0
}

# Capturar señales SIGINT y SIGTERM
trap cleanup SIGINT SIGTERM

# Mantener el script corriendo
wait