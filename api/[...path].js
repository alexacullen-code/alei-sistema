const { createPool } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');

// IMPORTANTE: Usar CommonJS (require) y NO ES Modules (import)
// para evitar el warning "Node.js functions are compiled from ESM to CommonJS"

const pool = createPool(process.env.DATABASE_URL);

// Helper CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const jsonResponse = (data, status = 200) => ({
  statusCode: status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

// Router principal - SINTAXIS COMMONJS
module.exports = async (req, res) => {
  // Manejar CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  const path = req.url.replace('/api/', '').split('?')[0];
  const method = req.method;

  try {
    // Tu lógica de rutas aquí...
    
    if (path === 'test') {
      return jsonResponse({ message: 'API funcionando', nodeVersion: process.version });
    }

    // ... resto de tu código ...

    return jsonResponse({ error: 'Ruta no encontrada' }, 404);
    
  } catch (error) {
    console.error('Error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
};
