const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}

console.log('🔧 Configuración del Bot:');
console.log('📁 Directorio actual:', __dirname);
console.log('📄 Archivo .env:', path.resolve(__dirname, '../.env'));
console.log('🔑 BOT_TOKEN:', process.env.BOT_TOKEN ? '✅ Cargado' : '❌ No encontrado');
console.log('🗄️ SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Cargado' : '❌ No encontrado');
console.log('🔐 SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Cargado' : '❌ No encontrado');
console.log('');

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ ERROR: BOT_TOKEN no está configurado en el archivo .env');
  console.error('📍 Verifica que el archivo .env existe en:', path.resolve(__dirname, '../.env'));
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Supabase configuración
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERROR: Supabase credentials no están configuradas');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ✅ Guardar estados pendientes por usuario
const pendingActions = new Map();

// Emojis según el rol
const getRoleBadge = (role) => {
  switch (role) {
    case 'admin': return '👑 ADMIN';
    case 'seller': return '💼 SELLER';
    case 'user': return '👤 USUARIO';
    default: return '👤 USUARIO';
  }
};

// ==================== COMANDOS ====================

bot.start(async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const firstName = ctx.from.first_name;
  
  console.log(`📥 Comando /start de ${firstName} (ID: ${telegramId})`);
  
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('username, email, role')
      .eq('telegram_id', telegramId)
      .single();

    if (error || !user) {
      console.log(`❌ Usuario ${telegramId} no registrado`);
      ctx.reply(
        `❌ *No estás registrado en Jem Box*\n\n` +
        `Hola ${firstName}, para recibir notificaciones debes registrarte primero en nuestra plataforma.\n\n` +
        `🔗 Regístrate aquí: jem-box.vercel.app\n\n` +
        `📱 Tu ID de Telegram es: \`${telegramId}\`\n` +
        `Úsalo al registrarte para vincular tu cuenta.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      console.log(`✅ Usuario encontrado: ${user.username} (${user.role})`);
      const roleBadge = getRoleBadge(user.role);
      
      let message = `🎉 *¡Bienvenido a Jem Box, ${user.username}!*\n\n` +
        `✅ Tu cuenta está activa\n` +
        `${roleBadge}\n` +
        `📱 ID Telegram: \`${telegramId}\`\n` +
        `📧 Email: ${user.email}\n\n`;

      if (user.role === 'admin' || user.role === 'seller') {
        message += `📋 *Comandos disponibles:*\n` +
          `• /aceptar_ID - Aprobar compra\n` +
          `• /rechazar_ID - Rechazar compra\n` +
          `• /cancelar - Cancelar acción pendiente\n`;
        
        if (user.role === 'admin') {
          message += `• /notify mensaje - Notificación masiva\n`;
        }
      } else {
        message += `Ya puedes recibir notificaciones de:\n` +
          `• Nuevos productos y ofertas\n` +
          `• Confirmación de compras\n` +
          `• Actualizaciones importantes\n`;
      }

      message += `\n🛒 Visita: jem-box.vercel.app`;
      
      ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error('❌ Error en /start:', err);
    ctx.reply('❌ Error al verificar tu cuenta. Intenta de nuevo en unos minutos.');
  }
});

// === COMANDO /aceptar_ID o /aceptarID (ambos formatos) ===
bot.hears(/^\/aceptar_?(\d+)$/, async (ctx) => {
  const purchaseId = ctx.match[1];
  const telegramId = ctx.from.id.toString();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📥 COMANDO /aceptar_${purchaseId} recibido`);
  console.log(`👤 De: ${ctx.from.first_name} (ID: ${telegramId})`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // Verificar que sea admin o seller
    console.log('🔍 Verificando permisos del usuario...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role, username')
      .eq('telegram_id', telegramId)
      .single();

    if (userError) {
      console.error('❌ Error en consulta de usuario:', userError);
      return ctx.reply('❌ Error al verificar tus permisos. Intenta nuevamente.');
    }

    if (!user) {
      console.log('❌ Usuario no encontrado en BD');
      return ctx.reply('❌ No estás registrado en el sistema.');
    }

    console.log(`✅ Usuario: ${user.username} - Rol: ${user.role}`);

    if (user.role !== 'admin' && user.role !== 'seller') {
      console.log(`⛔ Acceso denegado (rol: ${user.role})`);
      return ctx.reply('❌ No tienes permisos para aprobar compras.');
    }

    // Obtener la compra
    console.log(`🔍 Buscando compra #${purchaseId}...`);
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', purchaseId)
      .single();

    if (purchaseError) {
      console.error('❌ Error en consulta de compra:', purchaseError);
      return ctx.reply(`❌ Error al obtener la compra #${purchaseId}: ${purchaseError.message}`);
    }

    if (!purchase) {
      console.log(`❌ Compra #${purchaseId} no existe`);
      return ctx.reply(`❌ No se encontró la compra #${purchaseId}`);
    }

    console.log(`✅ Compra encontrada:`);
    console.log(`   ID: ${purchase.id}`);
    console.log(`   Usuario: ${purchase.username}`);
    console.log(`   Estado: ${purchase.status}`);
    console.log(`   Servicio: ${purchase.service} - ${purchase.plan}`);

    if (purchase.status !== 'pending') {
      console.log(`⚠️ Compra ya procesada (${purchase.status})`);
      return ctx.reply(
        `❌ Esta compra ya fue procesada.\nEstado actual: *${purchase.status}*`,
        { parse_mode: 'Markdown' }
      );
    }

    // ✅ Guardar en Map
    pendingActions.set(telegramId, {
      type: 'approval',
      purchaseId,
      adminUsername: user.username,
      purchase
    });

    console.log(`💾 Acción de aprobación guardada en memoria`);
    console.log(`   Esperando credenciales en formato: email|contraseña`);

    ctx.reply(
      `✅ *Aprobando compra #${purchaseId}*\n\n` +
      `📦 *Servicio:* ${purchase.service}\n` +
      `📋 *Plan:* ${purchase.plan}\n` +
      `⏱️ *Duración:* ${purchase.duration}\n` +
      `💰 *Precio:* ${purchase.price}\n` +
      `👤 *Usuario:* ${purchase.username}\n` +
      `🌍 *País:* ${purchase.country}\n\n` +
      `📝 *Instrucciones:*\n` +
      `Envía los datos de la cuenta en el siguiente formato:\n\n` +
      `\`email@ejemplo.com|contraseña123\`\n\n` +
      `*Ejemplo:*\n` +
      `\`netflix@gmail.com|Pass1234\`\n\n` +
      `⚠️ Usa el símbolo | (barra vertical) para separar\n\n` +
      `_Usa /cancelar para abortar_`,
      { parse_mode: 'Markdown' }
    );

    console.log(`✅ Mensaje enviado al admin`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (err) {
    console.error('❌ Error inesperado en /aceptar:', err);
    ctx.reply('❌ Error al procesar la aprobación: ' + err.message);
  }
});

// === COMANDO /rechazar_ID o /rechazarID (ambos formatos) ===
bot.hears(/^\/rechazar_?(\d+)$/, async (ctx) => {
  const purchaseId = ctx.match[1];
  const telegramId = ctx.from.id.toString();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📥 COMANDO /rechazar_${purchaseId} recibido`);
  console.log(`👤 De: ${ctx.from.first_name} (ID: ${telegramId})`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // Verificar que sea admin o seller
    console.log('🔍 Verificando permisos del usuario...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role, username')
      .eq('telegram_id', telegramId)
      .single();

    if (userError) {
      console.error('❌ Error en consulta de usuario:', userError);
      return ctx.reply('❌ Error al verificar tus permisos. Intenta nuevamente.');
    }

    if (!user) {
      console.log('❌ Usuario no encontrado en BD');
      return ctx.reply('❌ No estás registrado en el sistema.');
    }

    console.log(`✅ Usuario: ${user.username} - Rol: ${user.role}`);

    if (user.role !== 'admin' && user.role !== 'seller') {
      console.log(`⛔ Acceso denegado (rol: ${user.role})`);
      return ctx.reply('❌ No tienes permisos para rechazar compras.');
    }

    // Obtener la compra
    console.log(`🔍 Buscando compra #${purchaseId}...`);
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', purchaseId)
      .single();

    if (purchaseError) {
      console.error('❌ Error en consulta de compra:', purchaseError);
      return ctx.reply(`❌ Error al obtener la compra #${purchaseId}: ${purchaseError.message}`);
    }

    if (!purchase) {
      console.log(`❌ Compra #${purchaseId} no existe`);
      return ctx.reply(`❌ No se encontró la compra #${purchaseId}`);
    }

    console.log(`✅ Compra encontrada:`);
    console.log(`   ID: ${purchase.id}`);
    console.log(`   Usuario: ${purchase.username}`);
    console.log(`   Estado: ${purchase.status}`);

    if (purchase.status !== 'pending') {
      console.log(`⚠️ Compra ya procesada (${purchase.status})`);
      return ctx.reply(
        `❌ Esta compra ya fue procesada.\nEstado actual: *${purchase.status}*`,
        { parse_mode: 'Markdown' }
      );
    }

    // ✅ Guardar en Map
    pendingActions.set(telegramId, {
      type: 'rejection',
      purchaseId,
      adminUsername: user.username,
      purchase
    });

    console.log(`💾 Acción de rechazo guardada en memoria`);
    console.log(`   Esperando motivo del rechazo...`);

    ctx.reply(
      `❌ *Rechazando compra #${purchaseId}*\n\n` +
      `📦 *Servicio:* ${purchase.service}\n` +
      `📋 *Plan:* ${purchase.plan}\n` +
      `⏱️ *Duración:* ${purchase.duration}\n` +
      `💰 *Precio:* ${purchase.price}\n` +
      `👤 *Usuario:* ${purchase.username}\n\n` +
      `📝 *Por favor, envía el motivo del rechazo:*\n\n` +
      `_Usa /cancelar para abortar_`,
      { parse_mode: 'Markdown' }
    );

    console.log(`✅ Mensaje enviado al admin`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (err) {
    console.error('❌ Error inesperado en /rechazar:', err);
    ctx.reply('❌ Error al procesar el rechazo: ' + err.message);
  }
});

// === COMANDO /cancelar ===
bot.command('cancelar', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  
  console.log(`🔄 Comando /cancelar de ${ctx.from.first_name} (${telegramId})`);
  
  if (pendingActions.has(telegramId)) {
    const pending = pendingActions.get(telegramId);
    pendingActions.delete(telegramId);
    console.log(`✅ Acción cancelada: ${pending.type} para compra #${pending.purchaseId}`);
    ctx.reply('✅ Acción pendiente cancelada correctamente.');
  } else {
    console.log('ℹ️ No hay acciones pendientes');
    ctx.reply('ℹ️ No tienes ninguna acción pendiente.');
  }
});

// === COMANDO /notify (SOLO ADMINS) ===
bot.command('notify', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  
  console.log(`📢 Comando /notify de ${ctx.from.first_name} (${telegramId})`);
  
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('role, username')
      .eq('telegram_id', telegramId)
      .single();

    if (error || !user) {
      console.log('❌ Usuario no encontrado');
      return ctx.reply('❌ No tienes acceso a este comando.');
    }

    if (user.role !== 'admin') {
      console.log(`⛔ Acceso denegado (rol: ${user.role})`);
      return ctx.reply('❌ Solo los administradores pueden enviar notificaciones.');
    }

    const message = ctx.message.text.replace('/notify', '').trim();
    
    if (!message) {
      console.log('ℹ️ Comando sin mensaje, enviando instrucciones');
      return ctx.reply(
        '📢 *Comando /notify*\n\n' +
        'Uso: `/notify tu mensaje aquí`\n\n' +
        'Este mensaje será enviado a todos los usuarios registrados.',
        { parse_mode: 'Markdown' }
      );
    }

    console.log(`📤 Enviando notificación masiva: "${message.substring(0, 50)}..."`);

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('telegram_id, username');

    if (usersError || !users) {
      console.error('❌ Error obteniendo usuarios:', usersError);
      return ctx.reply('❌ Error al obtener usuarios.');
    }

    console.log(`👥 Enviando a ${users.length} usuarios...`);
    let sent = 0;
    let failed = 0;

    await ctx.reply(`📤 Enviando notificación a ${users.length} usuarios...`);

    for (const targetUser of users) {
      try {
        await ctx.telegram.sendMessage(
          targetUser.telegram_id,
          `📢 *Notificación de Jem Box*\n\n${message}`,
          { parse_mode: 'Markdown' }
        );
        sent++;
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        failed++;
        console.error(`❌ Error enviando a ${targetUser.username}:`, err.message);
      }
    }

    console.log(`✅ Notificación completada: ${sent} enviadas, ${failed} fallidas`);

    ctx.reply(
      `✅ *Notificación completada*\n\n` +
      `📤 Enviadas: ${sent}\n` +
      `❌ Fallidas: ${failed}\n` +
      `📊 Total usuarios: ${users.length}`,
      { parse_mode: 'Markdown' }
    );

  } catch (err) {
    console.error('❌ Error en /notify:', err);
    ctx.reply('❌ Error al enviar notificación.');
  }
});

// === ESCUCHAR RESPUESTAS DE TEXTO (DEBE IR AL FINAL) ===
bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text.trim();

  // Ignorar comandos - ya fueron procesados por los handlers anteriores
  if (text.startsWith('/')) {
    return;
  }

  // ✅ Verificar si hay acción pendiente
  const pending = pendingActions.get(telegramId);
  if (!pending) {
    return; // No hacer nada si no hay acción pendiente
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 PROCESANDO RESPUESTA`);
  console.log(`👤 Usuario: ${ctx.from.first_name} (${telegramId})`);
  console.log(`🔄 Tipo: ${pending.type}`);
  console.log(`📦 Compra: #${pending.purchaseId}`);
  console.log(`💬 Texto: "${text}"`);
  console.log(`${'='.repeat(60)}`);

  // ==================== APROBAR COMPRA ====================
  if (pending.type === 'approval') {
    console.log('✅ Procesando aprobación de compra...');
    
    // Validar formato email|password
    if (!text.includes('|')) {
      console.log('❌ Formato inválido: falta el separador |');
      return ctx.reply(
        '❌ *Formato incorrecto*\n\n' +
        'Debes usar el formato: `email|contraseña`\n\n' +
        '*Ejemplo:*\n' +
        '`netflix@gmail.com|Pass1234`\n\n' +
        'Usa el símbolo | (barra vertical) para separar.',
        { parse_mode: 'Markdown' }
      );
    }

    const parts = text.split('|');
    
    if (parts.length !== 2) {
      console.log(`❌ Formato inválido: ${parts.length} partes encontradas (se esperan 2)`);
      return ctx.reply(
        '❌ *Formato incorrecto*\n\n' +
        'Debes enviar exactamente: email|contraseña\n\n' +
        '*Ejemplo:*\n' +
        '`user@gmail.com|password123`',
        { parse_mode: 'Markdown' }
      );
    }

    const email = parts[0].trim();
    const password = parts[1].trim();

    console.log(`   Email: ${email}`);
    console.log(`   Password: ${'*'.repeat(password.length)}`);

    if (!email || !password) {
      console.log('❌ Email o contraseña vacíos');
      return ctx.reply('❌ El email o la contraseña no pueden estar vacíos.');
    }

    // Validación básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Formato de email inválido');
      return ctx.reply('❌ El email no tiene un formato válido.');
    }

    console.log('✅ Formato válido. Actualizando compra en Supabase...');

    try {
      const { data: updatedPurchase, error } = await supabase
        .from('purchases')
        .update({
          status: 'approved',
          account_email: email,
          account_password: password,
          approved_by: pending.adminUsername,
          updated_at: new Date().toISOString()
        })
        .eq('id', pending.purchaseId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error de Supabase:', error);
        return ctx.reply('❌ Error al aprobar la compra: ' + error.message);
      }

      if (!updatedPurchase) {
        console.error('❌ No se retornó la compra actualizada');
        return ctx.reply('❌ Error: No se pudo actualizar la compra.');
      }

      console.log('✅ Compra actualizada en BD exitosamente');
      console.log(`   Status: ${updatedPurchase.status}`);
      console.log(`   Aprobada por: ${updatedPurchase.approved_by}`);

      // Notificar al comprador
      console.log(`📤 Notificando al comprador (${updatedPurchase.telegram_id})...`);
      const mensajeComprador = 
        `🎉 *¡Tu compra ha sido aprobada!*\n\n` +
        `🎬 *Servicio:* ${updatedPurchase.service}\n` +
        `📦 *Plan:* ${updatedPurchase.plan}\n` +
        `⏱️ *Duración:* ${updatedPurchase.duration}\n\n` +
        `🔐 *Datos de acceso:*\n` +
        `📧 Email: \`${email}\`\n` +
        `🔑 Contraseña: \`${password}\`\n\n` +
        `✅ Ya puedes disfrutar de tu servicio\n` +
        `💡 Guarda estos datos en un lugar seguro\n\n` +
        `¡Gracias por tu compra! 🚀`;

      try {
        await ctx.telegram.sendMessage(
          updatedPurchase.telegram_id,
          mensajeComprador,
          { parse_mode: 'Markdown' }
        );
        console.log('✅ Comprador notificado');
      } catch (err) {
        console.error('❌ Error al notificar comprador:', err.message);
      }

      await ctx.reply(
        `✅ *Compra #${pending.purchaseId} aprobada exitosamente*\n\n` +
        `👤 Usuario: ${updatedPurchase.username}\n` +
        `📧 Email: ${email}\n` +
        `🔑 Contraseña: ${password}\n\n` +
        `✉️ El usuario ha sido notificado`,
        { parse_mode: 'Markdown' }
      );

      // ✅ Limpiar acción pendiente
      pendingActions.delete(telegramId);
      console.log('🧹 Acción limpiada de memoria');
      console.log(`✅ PROCESO COMPLETADO`);
      console.log(`${'='.repeat(60)}\n`);

    } catch (err) {
      console.error('❌ Error inesperado:', err);
      ctx.reply('❌ Error al procesar la aprobación: ' + err.message);
    }
  }
  // ==================== RECHAZAR COMPRA ====================
  else if (pending.type === 'rejection') {
    console.log('❌ Procesando rechazo de compra...');
    const reason = text;

    console.log(`   Motivo: "${reason}"`);

    if (reason.length < 10) {
      console.log('❌ Motivo muy corto');
      return ctx.reply('❌ El motivo del rechazo debe tener al menos 10 caracteres.');
    }

    console.log('✅ Motivo válido. Actualizando compra en Supabase...');

    try {
      const { data: updatedPurchase, error } = await supabase
        .from('purchases')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          rejected_by: pending.adminUsername,
          updated_at: new Date().toISOString()
        })
        .eq('id', pending.purchaseId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error de Supabase:', error);
        return ctx.reply('❌ Error al rechazar la compra: ' + error.message);
      }

      if (!updatedPurchase) {
        console.error('❌ No se retornó la compra actualizada');
        return ctx.reply('❌ Error: No se pudo actualizar la compra.');
      }

      console.log('✅ Compra actualizada en BD exitosamente');
      console.log(`   Status: ${updatedPurchase.status}`);
      console.log(`   Rechazada por: ${updatedPurchase.rejected_by}`);

      // Notificar al comprador
      console.log(`📤 Notificando al comprador (${updatedPurchase.telegram_id})...`);
      const mensajeComprador = 
        `❌ *Tu compra ha sido rechazada*\n\n` +
        `🎬 *Servicio:* ${updatedPurchase.service}\n` +
        `📦 *Plan:* ${updatedPurchase.plan}\n\n` +
        `📝 *Motivo del rechazo:*\n${reason}\n\n` +
        `📞 Contacta a soporte: @soyjemoox`;

      try {
        await ctx.telegram.sendMessage(
          updatedPurchase.telegram_id,
          mensajeComprador,
          { parse_mode: 'Markdown' }
        );
        console.log('✅ Comprador notificado');
      } catch (err) {
        console.error('❌ Error al notificar comprador:', err.message);
      }

      await ctx.reply(
        `❌ *Compra #${pending.purchaseId} rechazada*\n\n` +
        `👤 Usuario: ${updatedPurchase.username}\n` +
        `📝 Motivo: ${reason}\n\n` +
        `✉️ El usuario ha sido notificado`,
        { parse_mode: 'Markdown' }
      );

      // ✅ Limpiar acción pendiente
      pendingActions.delete(telegramId);
      console.log('🧹 Acción limpiada de memoria');
      console.log(`✅ PROCESO COMPLETADO`);
      console.log(`${'='.repeat(60)}\n`);

    } catch (err) {
      console.error('❌ Error inesperado:', err);
      ctx.reply('❌ Error al procesar el rechazo: ' + err.message);
    }
  }
});

// Manejo de errores global
bot.catch((err, ctx) => {
  console.error('\n❌❌❌ ERROR GLOBAL DEL BOT ❌❌❌');
  console.error('Error:', err);
  console.error('Contexto:', {
    updateType: ctx.updateType,
    from: ctx.from,
    message: ctx.message
  });
  console.error('❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌\n');
  
  try {
    ctx.reply('❌ Ocurrió un error inesperado. Por favor intenta nuevamente.');
  } catch (replyErr) {
    console.error('No se pudo enviar mensaje de error:', replyErr);
  }
});

// Lanzar bot
console.log('🚀 Iniciando bot...\n');

bot.launch()
  .then(() => {
    console.log('✅✅✅ BOT INICIADO EXITOSAMENTE ✅✅✅');
    console.log('');
    console.log('📋 Comandos disponibles:');
    console.log('   🔹 /start - Verificar registro');
    console.log('   🔹 /aceptar_ID - Aprobar compra (admin/seller)');
    console.log('   🔹 /rechazar_ID - Rechazar compra (admin/seller)');
    console.log('   🔹 /cancelar - Cancelar acción pendiente');
    console.log('   🔹 /notify mensaje - Notificación masiva (solo admin)');
    console.log('');
    console.log('📡 Bot escuchando mensajes...');
    console.log('🔊 Los logs aparecerán cuando lleguen comandos');
    console.log('='.repeat(60));
    console.log('');
  })
  .catch(err => {
    console.error('❌❌❌ ERROR AL INICIAR BOT ❌❌❌');
    console.error(err);
    process.exit(1);
  });

// Manejo de cierre graceful
process.once('SIGINT', () => {
  console.log('\n🛑 Deteniendo bot (SIGINT)...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('\n🛑 Deteniendo bot (SIGTERM)...');
  bot.stop('SIGTERM');
});
