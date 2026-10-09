# Personeros IAAS - Sistema Serverless de Votación

Proyecto serverless en AWS para el sistema de conteo de votos de Personeros usando Serverless Framework.

## Arquitectura

- **API Gateway**: Endpoints REST para las APIs
- **Lambda Functions**: Lógica de negocio
- **DynamoDB**: Base de datos NoSQL
  - `record_items`: Almacena candidatos, votos nulos y votos en blanco
  - `records`: Almacena actas con referencias a record_items
  - `users`: Almacena usuarios y sus roles
- **AWS AppConfig**: Sistema de feature flags para configuración dinámica

## Estructura del Proyecto

```
personeros-iaas/
├── serverless.yml            # Configuración de Serverless Framework
├── package.json              # Dependencias de Node.js
├── functions/
│   ├── register-users/           # Lambda: Registrar usuarios
│   ├── login-user/              # Lambda: Login de usuarios
│   ├── check-acta-registered/   # Lambda: Verificar si acta está registrada
│   ├── save-acta/               # Lambda: Guardar nueva acta
│   ├── update-acta/             # Lambda: Actualizar acta existente
│   ├── get-actas/               # Lambda: Obtener todas las actas
│   ├── get-candidate-votes/     # Lambda: Obtener votos por candidato
│   ├── get-feature-flag/        # Lambda: Consultar feature flags
│   └── get-app-status/          # Lambda: Obtener estado de la aplicación
└── README.md
```

## APIs

### 1. Registrar Usuarios (POST /users)

Registra uno o varios usuarios. Cada objeto debe incluir DNI (8 dígitos), nombre y rol válido (`admin`, `coordinador` o `personero`). Los registros existentes no se sobrescriben.

**Request Body:**
```json
[
  { "dni": "12345678", "rol": "admin", "nombre": "Juan Perez" },
  { "dni": "23456789", "rol": "personero", "nombre": "Maria Garcia" }
]
```

**Response:**
```json
{
  "created": [
    { "dni": "12345678", "status": "created" },
    { "dni": "23456789", "status": "created" }
  ],
  "duplicates": []
}
```

### 2. Login Usuario (POST /users/login)

Verifica si un usuario está registrado por su DNI.

**Request Body:**
```json
{
  "dni": "12345678"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dni": "12345678",
    "rol": "admin",
    "nombre": "Juan Perez"
  }
}
```

### 3. Verificar Acta Registrada (POST /users/acta-registered)

Verifica si una acta ya está registrada en el sistema.

**Request Body:**
```json
{
  "numeroActa": "001"
}
```

**Response:**
```json
{
  "success": true,
  "registered": true
}
```

### 4. Guardar Acta (POST /records)

Guarda una nueva acta en el sistema.

**Request Body:**
```json
{
  "numeroActa": "001",
  "lugar": "Micaela Bastidas",
  "items": [
    { "id": "item-1", "votos": 45 },
    { "id": "item-2", "votos": 32 }
  ],
  "dniUsuario": "12345678"
}
```

**Response:**
```json
{
  "success": true,
  "actaId": "ACTA-1234567890"
}
```

### 5. Actualizar Acta (PUT /records/{actaId})

Actualiza una acta existente.

**Request Body:**
```json
{
  "items": [
    { "id": "item-1", "votos": 50 },
    { "id": "item-2", "votos": 35 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Acta updated successfully"
}
```

### 6. Obtener Actas (GET /records)

Obtiene todas las actas registradas con sus detalles.

**Response:**
```json
{
  "success": true,
  "data": {
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
          }
        ],
        "dniUsuario": "12345678",
        "nombreUsuario": "Juan Perez",
        "noVotantes": 0,
        "fecha": "2026-01-10T20:30:00.000Z"
      }
    ]
  }
}
```

### 7. Obtener Votos por Candidato (GET /votes/candidates)

Obtiene la sumatoria de votos por candidato.

**Response:**
```json
{
  "success": true,
  "data": {
    "candidates": [...]
  }
}
```

### 8. Obtener Feature Flag (GET /feature-flags/{featureName})

Consulta el estado de un feature flag configurado en AWS AppConfig.

**Example:**
```
GET /feature-flags/enableNewVotingSystem
```

**Response:**
```json
{
  "success": true,
  "data": {
    "featureName": "enableNewVotingSystem",
    "enabled": true
  }
}
```

### Feature Flags con AWS AppConfig

El sistema usa AWS AppConfig para gestionar feature flags dinámicamente. Los valores pueden cambiarse desde la AWS Console sin modificar el código.

**Cambiar un feature flag desde AWS Console:**

1. Ve a AWS Console → **AppConfig**
2. Aplicación: `PersonerosFeatureFlags`
3. **Configuration profiles** → `FeatureFlags`
4. Click en **Create version**
5. Modifica el JSON de configuración:
   ```json
   {
     "features": {
       "enableNewVotingSystem": false
     }
   }
   ```
6. Click en **Create configuration version**
7. Ve a **Deployments** → **Start deployment**
8. Selecciona la nueva versión y el ambiente `Production`
9. Una vez completado, el endpoint automáticamente retorna el nuevo valor

## Requisitos Previos

1. AWS CLI configurado con credenciales
2. Serverless Framework instalado: `npm install -g serverless`
3. Node.js instalado (v20.x recomendado)

## Instalación y Despliegue

### 1. Instalar dependencias
```bash
cd personeros-iaas
npm install
```

### 2. Desplegar en AWS
```bash
npm run deploy
```

### 3. Obtener la URL de la API
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

### Registrar Usuarios
```bash
curl -X POST https://tu-api.execute-api.us-east-1.amazonaws.com/dev/users \
  -H "Content-Type: application/json" \
  -d '[
    { "dni": "12345678", "rol": "admin", "nombre": "Juan Perez" },
    { "dni": "23456789", "rol": "personero", "nombre": "Maria Garcia" }
  ]'
```

### Login Usuario
```bash
curl -X POST https://tu-api.execute-api.us-east-1.amazonaws.com/dev/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "dni": "12345678"
  }'
```

### Guardar Acta
```bash
curl -X POST https://tu-api.execute-api.us-east-1.amazonaws.com/dev/records \
  -H "Content-Type: application/json" \
  -d '{
    "numeroActa": "001",
    "lugar": "Micaela Bastidas",
    "items": [
      { "id": "item-1", "votos": 45 },
      { "id": "item-2", "votos": 32 }
    ],
    "dniUsuario": "12345678"
  }'
```

### Obtener Actas
```bash
curl https://tu-api.execute-api.us-east-1.amazonaws.com/dev/records
```

### Obtener Votos por Candidato
```bash
curl https://tu-api.execute-api.us-east-1.amazonaws.com/dev/votes/candidates
```

### Consultar Feature Flag
```bash
curl https://tu-api.execute-api.us-east-1.amazonaws.com/dev/feature-flags/enableNewVotingSystem
```

## Integración con Flutter App

Para integrar con la app Flutter, reemplaza el `StorageService` local por llamadas HTTP a estas APIs:

```dart
// Ejemplo en Flutter - Guardar Acta
final response = await http.post(
  Uri.parse('https://tu-api.execute-api.us-east-1.amazonaws.com/dev/records'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'numeroActa': numeroActa,
    'lugar': lugar,
    'items': [
      {'id': 'item-1', 'votos': 45},
      {'id': 'item-2', 'votos': 32}
    ],
    'dniUsuario': dni
  }),
);

// Ejemplo en Flutter - Consultar Feature Flag
final response = await http.get(
  Uri.parse('https://tu-api.execute-api.us-east-1.amazonaws.com/dev/feature-flags/enableNewVotingSystem'),
);

final data = jsonDecode(response.body);
final isEnabled = data['data']['enabled'];
```

## Limpieza

Para eliminar todos los recursos de AWS:
```bash
npm run remove
```

## Notas Importantes

1. **AWS AppConfig**: Los feature flags se gestionan a través de AWS AppConfig. Los cambios se aplican inmediatamente después del deployment.
2. **Costos**: DynamoDB en modo PAY_PER_REQUEST cuesta por read/write units. Lambda tiene una capa gratuita.
3. **Región**: El template usa `us-east-1`. Cambia en `serverless.yml` si necesitas otra región.
4. **CORS**: Los endpoints están configurados con CORS abierto (`origin: '*'`). Para producción, restringe a dominios específicos.
5. **Seguridad**: Los endpoints no tienen autenticación configurada. Considera agregar Cognito, JWT o API Gateway authorizers para producción.
