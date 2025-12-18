const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
}
console.log('BOT_TOKEN cargado:', !!process.env.BOT_TOKEN);

const app = express();
app.use(express.json());
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

// Supabase configuración
const supabaseUrl = process.env.SUPABASE_URL || 'https://qdpabaurdhrmzuppklnu.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_GDNl0pjiSFk8XaPnOYNNvw_fMH-k7hx';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Bot token y canal privado
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_CHAT_ID = '-1003690656735';

// Función para verificar si el usuario está en el canal
async function isUserInChannel(telegramId) {
  if (!BOT_TOKEN) {
    console.warn('BOT_TOKEN no configurado. Verificación de canal desactivada.');
    return true;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHANNEL_CHAT_ID,
        user_id: parseInt(telegramId)
      })
    });

    const data = await response.json();

    if (data.ok) {
      const status = data.result.status;
      return ['member', 'administrator', 'creator'].includes(status);
    }
    return false;
  } catch (err) {
    console.error('Error verificando membresía:', err);
    return false;
  }
}

// === REGISTRO ===
app.post('/api/register', async (req, res) => {
  const { username, email, password, confirmPassword, telegramId } = req.body;

  if (!username || !email || !password || !confirmPassword || !telegramId) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  }

  try {
    const inChannel = await isUserInChannel(telegramId);
    if (!inChannel) {
      return res.status(403).json({
        error: 'No estás suscrito al canal oficial Jem Box Updates.'
      });
    }

    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const { data, error } = await supabase
      .from('users')
      .insert({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        telegram_id: telegramId.toString(),
        role: 'user'
      })
      .select();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Usuario, email o ID Telegram ya registrado' });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, message: '¡Registro exitoso! Bienvenido a Jem Box.' });
  } catch (err) {
    console.error('Error inesperado:', err);
    res.status(500).json({ error: 'Error interno. Contacta a @soyjemoox' });
  }
});

// === LOGIN ===
app.post('/api/login', async (req, res) => {
  const { username, password, telegramId } = req.body;

  if (!username || !password || !telegramId) {
    return res.status(400).json({ error: 'Usuario, contraseña e ID Telegram son obligatorios' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('password_hash, telegram_id, role')
      .eq('username', username.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const hashedInput = crypto.createHash('sha256').update(password).digest('hex');
    if (hashedInput !== user.password_hash) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    if (user.telegram_id.toString() !== telegramId) {
      return res.status(401).json({ error: 'ID Telegram no coincide con el registrado' });
    }

    const inChannel = await isUserInChannel(telegramId);
    if (!inChannel) {
      return res.status(403).json({ error: 'Ya no estás en el canal oficial. Debes estar suscrito para acceder.' });
    }

    res.json({ 
      success: true, 
      message: '¡Login exitoso! Bienvenido de vuelta.',
      role: user.role
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno. Contacta a @soyjemoox' });
  }
});

// === CREAR COMPRA ===
app.post('/api/purchase', upload.single('screenshot'), async (req, res) => {
  const { username, service, plan, duration, price, country, paymentMethod } = req.body;
  const screenshot = req.file;

  if (!screenshot) {
    return res.status(400).json({ error: 'No se recibió la captura de pago' });
  }

  try {
    // Obtener telegram_id del usuario
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('username', username.toLowerCase())
      .single();

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Convertir imagen a base64 para guardarla
    const screenshotBase64 = screenshot.buffer.toString('base64');

    // Guardar compra en Supabase
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        username: username.toLowerCase(),
        telegram_id: user.telegram_id,
        service,
        plan,
        duration,
        price,
        country,
        payment_method: paymentMethod,
        screenshot_url: screenshotBase64,
        status: 'pending'
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('Error guardando compra:', purchaseError);
      return res.status(500).json({ error: 'Error al guardar la compra' });
    }

    // Obtener admins y sellers para notificar
    const { data: admins } = await supabase
      .from('users')
      .select('telegram_id, username, role')
      .in('role', ['admin', 'seller']);

    // Preparar mensaje con ID de compra
    const mensaje = `🛒 *NUEVA COMPRA PENDIENTE*

🆔 ID: #${purchase.id}
👤 Usuario: ${username}
🎬 Servicio: ${service}
📦 Plan: ${plan} (${duration})
💰 Precio: ${price}
🌍 País: ${country}
💳 Método: ${paymentMethod}

📅 Fecha: ${new Date().toLocaleString('es-CO')}

✅ *Para aprobar:* /aceptar_${purchase.id}
❌ *Para rechazar:* /rechazar_${purchase.id}`;

    // Enviar notificación a admins/sellers
    if (admins && admins.length > 0) {
      for (const admin of admins) {
        try {
          const formData = new FormData();
          formData.append('chat_id', admin.telegram_id);
          formData.append('photo', new Blob([screenshot.buffer]), 'screenshot.jpg');
          formData.append('caption', mensaje);
          formData.append('parse_mode', 'Markdown');

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData
          });
        } catch (err) {
          console.error(`Error notificando a ${admin.username}:`, err);
        }
      }
    }

    res.json({ 
      success: true, 
      message: 'Compra enviada para verificación',
      purchaseId: purchase.id
    });

  } catch (err) {
    console.error('Error procesando compra:', err);
    res.status(500).json({ error: 'Error al procesar la compra' });
  }
});

// === OBTENER COMPRAS DEL USUARIO ===
app.get('/api/purchases/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('username', username.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, purchases });
  } catch (err) {
    console.error('Error obteniendo compras:', err);
    res.status(500).json({ error: 'Error al obtener compras' });
  }
});

// === OBTENER TODAS LAS COMPRAS (ADMIN) ===
app.get('/api/purchases', async (req, res) => {
  try {
    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, purchases });
  } catch (err) {
    console.error('Error obteniendo compras:', err);
    res.status(500).json({ error: 'Error al obtener compras' });
  }
});

// === APROBAR COMPRA ===
app.post('/api/purchase/approve', async (req, res) => {
  const { purchaseId, accountEmail, accountPassword, approvedBy } = req.body;

  try {
    const { data: purchase, error } = await supabase
      .from('purchases')
      .update({
        status: 'approved',
        account_email: accountEmail,
        account_password: accountPassword,
        approved_by: approvedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', purchaseId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, purchase });
  } catch (err) {
    console.error('Error aprobando compra:', err);
    res.status(500).json({ error: 'Error al aprobar compra' });
  }
});

// === RECHAZAR COMPRA ===
app.post('/api/purchase/reject', async (req, res) => {
  const { purchaseId, reason, rejectedBy } = req.body;

  try {
    const { data: purchase, error } = await supabase
      .from('purchases')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        rejected_by: rejectedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', purchaseId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, purchase });
  } catch (err) {
    console.error('Error rechazando compra:', err);
    res.status(500).json({ error: 'Error al rechazar compra' });
  }
});

// === CANCELAR/ELIMINAR COMPRA ===
app.delete('/api/purchase/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Obtener la compra antes de eliminarla
    const { data: purchase, error: fetchError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !purchase) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    // Solo permitir cancelar compras pendientes
    if (purchase.status !== 'pending') {
      return res.status(400).json({ error: 'Solo se pueden cancelar compras pendientes' });
    }

    // Eliminar la compra
    const { error: deleteError } = await supabase
      .from('purchases')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    // Notificar a admins/sellers que la compra fue cancelada
    const { data: admins } = await supabase
      .from('users')
      .select('telegram_id')
      .in('role', ['admin', 'seller']);

    if (admins && admins.length > 0) {
      const mensaje = `🚫 *Compra #${id} cancelada por el usuario*\n\n` +
        `👤 Usuario: ${purchase.username}\n` +
        `🎬 Servicio: ${purchase.service} - ${purchase.plan}`;

      for (const admin of admins) {
        try {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: admin.telegram_id,
              text: mensaje,
              parse_mode: 'Markdown'
            })
          });
        } catch (err) {
          console.error('Error notificando cancelación:', err);
        }
      }
    }

    res.json({ success: true, message: 'Compra cancelada' });
  } catch (err) {
    console.error('Error cancelando compra:', err);
    res.status(500).json({ error: 'Error al cancelar compra' });
  }
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Backend Jem Box activo y conectado a Supabase 🚀');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
  console.log('Supabase URL:', supabaseUrl);
  console.log('Verificación de canal activa para:', CHANNEL_CHAT_ID);
});