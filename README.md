# Personeros IAAS - Sistema Serverless de Votación

Proyecto serverless en AWS para el sistema de conteo de votos de Personeros usando Serverless Framework.

## Arquitectura

- **API Gateway**: Endpoints REST para las APIs
- **Lambda Functions**: Lógica de negocio
- **DynamoDB**: Base de datos NoSQL
  - `record_items`: Almacena candidatos, votos nulos y votos en blanco
  - `records`: Almacena actas con referencias a record_items
  - `users`: Almacena usuarios y sus roles
- **SNS**: Sistema de notificaciones para eventos de correo
- **SES**: Servicio de envío de correos

## Estructura del Proyecto

```
personeros-iaas/
├── serverless.yml            # Configuración de Serverless Framework
├── package.json              # Dependencias de Node.js
├── functions/
│   ├── register-users/     # Lambda: Registrar usuarios
│   ├── save-acta/           # Lambda: Guardar nueva acta
│   ├── get-actas/           # Lambda: Obtener todas las actas
│   ├── get-candidate-votes/ # Lambda: Obtener votos por candidato
│   └── send-email/          # Lambda: Enviar correo al guardar acta
└── README.md
```

## APIs

### 1. Registrar Usuarios (POST /usuarios)

Registra uno o varios usuarios. Cada objeto debe incluir únicamente un DNI numérico de 8 dígitos y un rol válido (`admin`, `coordinador` o `personero`). Los registros existentes no se sobrescriben.

**Request Body:**
```json
[
  { "dni": 12345678, "rol": "admin" },
  { "dni": 23456789, "rol": "personero" }
]
```

**Response:**
```json
{
  "created": [
    { "dni": 12345678, "status": "created" },
    { "dni": 23456789, "status": "created" }
  ],
  "duplicates": []
}
```

### 2. Guardar Acta (POST /actas)

Guarda una nueva acta y emite un evento para enviar correo.

**Request Body:**
```json
{
  "numeroActa": "001",
  "lugar": "Micaela Bastidas",
  "votos": {
    "candidatos": {
      "Marcos Enrique Ramos Bancayan": 45,
      "Rafael Grisolle Alvarez Calderon": 32,
      "Manuel Orlando Cruz Correa": 28,
      "Juan Manuel Chamaya Silva": 15,
      "Victor Raul Hidalgo Lopez": 10
    },
    "partidos": {
      "Marcos Enrique Ramos Bancayan": "Alianza para el Progreso",
      "Rafael Grisolle Alvarez Calderon": "Movimiento Independiente Fuerza Regional",
      "Manuel Orlando Cruz Correa": "Partido Democrático Somos Perú",
      "Juan Manuel Chamaya Silva": "Partido Político Perú Primero",
      "Victor Raul Hidalgo Lopez": "Podemos Perú"
    },
    "nulos": 5,
    "blancos": 3
  },
  "dniUsuario": "12345678"
}
```

**Response:**
```json
{
  "message": "Acta saved successfully",
  "actaId": "ACTA-1234567890",
  "numeroActa": "001",
  "lugar": "Micaela Bastidas"
}
```

### 3. Obtener Actas (GET /actas)

Obtiene todas las actas registradas con sus detalles.

**Response:**
```json
{
  "actas": [
    {
      "id": "ACTA-1234567890",
      "numeroActa": "001",
      "lugar": "Micaela Bastidas",
      "items": [
        {
          "nombre": "Marcos Enrique Ramos Bancayan",
          "tipo": "candidato",
          "votos": 45,
          "partido": "Alianza para el Progreso"
        },
        ...
      ],
      "dniUsuario": "12345678",
      "fecha": "2026-01-10T20:30:00.000Z"
    }
  ]
}
```

### 4. Obtener Votos por Candidato (GET /votes/candidates)

Obtiene la sumatoria de votos por candidato, ordenada de mayor a menor.

**Response:**
```json
{
  "candidates": [
    {
      "nombre": "Marcos Enrique Ramos Bancayan",
      "partido": "Alianza para el Progreso",
      "totalVotos": 150
    },
    {
      "nombre": "Rafael Grisolle Alvarez Calderon",
      "partido": "Movimiento Independiente Fuerza Regional",
      "totalVotos": 120
    },
    ...
  ]
}
```

## Requisitos Previos

1. AWS CLI configurado con credenciales
2. Serverless Framework instalado: `npm install -g serverless`
3. Node.js instalado
4. SES configurado con emails verificados (para envío de correos)

## Instalación y Despliegue

### 1. Instalar dependencias
```bash
cd personeros-iaas
npm install
```

### 2. Configurar SES (opcional - para envío de correos)
Edita `functions/send-email/index.js` y cambia los emails:
```javascript
const toEmail = 'tu-email@ejemplo.com';
const fromEmail = 'noreply@tudominio.com';
```

### 3. Desplegar en AWS
```bash
npm run deploy
```

### 4. Obtener la URL de la API
Después del despliegue, Serverless mostrará la URL de la API Gateway, algo como:
```
https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev
```

### Opciones adicionales de despliegue
- Desplegar en producción: `npm run deploy:prod`
- Ejecutar localmente: `npm run offline`
- Invocar función localmente: `npm run invoke:local --function save-acta`
- Ver logs: `npm run logs --function save-acta`

## Uso de las APIs

Una vez desplegado, puedes usar las APIs:

### Guardar Acta
```bash
curl -X POST https://tu-api.execute-api.us-east-1.amazonaws.com/Prod/actas \
  -H "Content-Type: application/json" \
  -d '{
    "numeroActa": "001",
    "lugar": "Micaela Bastidas",
    "votos": {
      "candidatos": {
        "Marcos Enrique Ramos Bancayan": 45,
        "Rafael Grisolle Alvarez Calderon": 32
      },
      "partidos": {
        "Marcos Enrique Ramos Bancayan": "Alianza para el Progreso",
        "Rafael Grisolle Alvarez Calderon": "Movimiento Independiente Fuerza Regional"
      },
      "nulos": 5,
      "blancos": 3
    },
    "dniUsuario": "12345678"
  }'
```

### Obtener Actas
```bash
curl https://tu-api.execute-api.us-east-1.amazonaws.com/Prod/actas
```

### Obtener Votos por Candidato
```bash
curl https://tu-api.execute-api.us-east-1.amazonaws.com/Prod/votes/candidates
```

## Integración con Flutter App

Para integrar con la app Flutter, reemplaza el `StorageService` local por llamadas HTTP a estas APIs:

```dart
// Ejemplo en Flutter
final response = await http.post(
  Uri.parse('https://tu-api.execute-api.us-east-1.amazonaws.com/Prod/actas'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'numeroActa': numeroActa,
    'lugar': lugar,
    'votos': {
      'candidatos': {...},
      'partidos': {...},
      'nulos': nulos,
      'blancos': blancos
    },
    'dniUsuario': dni
  }),
);
```

## Limpieza

Para eliminar todos los recursos de AWS:
```bash
npm run remove
```

## Notas Importantes

1. **SES Configuration**: El envío de correos requiere que configures AWS SES y verifiques los emails de origen y destino en modo sandbox.
2. **Costos**: DynamoDB en modo PAY_PER_REQUEST cuesta por read/write units. Lambda tiene una capa gratuita.
3. **Región**: El template usa `us-east-1`. Cambia en `samconfig.toml` si necesitas otra región.
