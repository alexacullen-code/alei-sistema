#!/usr/bin/env node

/**
 * Script de configuración inicial para ALEI
 * Ejecutar: node setup.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise(resolve => rl.question(prompt, resolve));
}

async function setup() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     ALEI - Sistema de Gestión Escolar v4.0            ║');
    console.log('║              Configuración Inicial                     ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // Verificar package.json
    console.log('✓ Verificando package.json...');
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
    
    if (packageJson.type !== 'module') {
        console.error('✗ Error: package.json debe tener "type": "module"');
        process.exit(1);
    }
    console.log('✓ package.json correcto\n');

    // Verificar vercel.json
    console.log('✓ Verificando vercel.json...');
    const vercelJson = JSON.parse(readFileSync('./vercel.json', 'utf8'));
    console.log('✓ vercel.json correcto\n');

    // Configuración de base de datos
    console.log('─────────────────────────────────────────────────────────');
    console.log('CONFIGURACIÓN DE BASE DE DATOS (Neon.tech)');
    console.log('─────────────────────────────────────────────────────────\n');
    
    console.log('1. Ve a https://neon.tech y crea una cuenta');
    console.log('2. Crea un nuevo proyecto');
    console.log('3. En el SQL Editor, copia y pega el contenido de db/schema.sql');
    console.log('4. Copia la cadena de conexión (DATABASE_URL)\n');

    const dbUrl = await question('DATABASE_URL: ');
    
    if (!dbUrl.startsWith('postgresql://')) {
        console.error('✗ Error: La URL debe comenzar con postgresql://');
        process.exit(1);
    }

    // Crear archivo .env
    const envContent = `# Base de datos PostgreSQL (Neon.tech)\nDATABASE_URL=${dbUrl}\n`;
    writeFileSync('.env', envContent);
    console.log('✓ Archivo .env creado\n');

    // Instrucciones de despliegue
    console.log('─────────────────────────────────────────────────────────');
    console.log('INSTRUCCIONES DE DESPLIEGUE');
    console.log('─────────────────────────────────────────────────────────\n');
    
    console.log('1. Instalar Vercel CLI:');
    console.log('   npm i -g vercel\n');
    
    console.log('2. Login en Vercel:');
    console.log('   vercel login\n');
    
    console.log('3. Desplegar:');
    console.log('   vercel --prod\n');
    
    console.log('4. Configurar variables de entorno en Vercel:');
    console.log('   - Ve al dashboard de Vercel');
    console.log('   - Selecciona tu proyecto');
    console.log('   - Settings > Environment Variables');
    console.log('   - Agrega DATABASE_URL con la misma URL\n');

    console.log('─────────────────────────────────────────────────────────');
    console.log('✓ Configuración completada!');
    console.log('─────────────────────────────────────────────────────────\n');

    rl.close();
}

setup().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
