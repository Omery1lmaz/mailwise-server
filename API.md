# API Documentation

Bu Node.js projesi template'inin API dokümantasyonu.

## Base URL

```
http://localhost:3000
```

## Endpoints

### Ana Endpoint

#### GET /
Ana sayfa bilgilerini döndürür.

**Response:**
```json
{
  "message": "Node.js Project Template API",
  "version": "1.0.0",
  "status": "running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### GET /health
Sistem sağlık durumunu kontrol eder.

**Response:**
```json
{
  "status": "OK",
  "uptime": 123.456,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### API Endpoints

#### GET /api
API bilgilerini döndürür.

**Response:**
```json
{
  "message": "API is working!",
  "endpoints": {
    "users": "/api/users",
    "examples": "/api/examples"
  },
  "version": "1.0.0"
}
```

## Users API

### GET /api/users
Tüm kullanıcıları listeler.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### GET /api/users/:id
Belirli bir kullanıcıyı getirir.

**Parameters:**
- `id` (number): Kullanıcı ID'si

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /api/users
Yeni kullanıcı oluşturur.

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### PUT /api/users/:id
Kullanıcı bilgilerini günceller.

**Parameters:**
- `id` (number): Kullanıcı ID'si

**Request Body:**
```json
{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Updated Name",
    "email": "updated@example.com",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### DELETE /api/users/:id
Kullanıcıyı siler.

**Parameters:**
- `id` (number): Kullanıcı ID'si

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

## Examples API

### GET /api/examples
Tüm örnekleri listeler.

**Query Parameters:**
- `status` (string, optional): Durum filtresi (active/inactive)
- `limit` (number, optional): Sonuç sayısı sınırı

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Example 1",
      "description": "This is the first example",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1,
  "total": 1
}
```

### GET /api/examples/:id
Belirli bir örneği getirir.

**Parameters:**
- `id` (number): Örnek ID'si

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Example 1",
    "description": "This is the first example",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /api/examples
Yeni örnek oluşturur.

**Request Body:**
```json
{
  "title": "New Example",
  "description": "This is a new example",
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "title": "New Example",
    "description": "This is a new example",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### PUT /api/examples/:id
Örnek bilgilerini günceller.

**Parameters:**
- `id` (number): Örnek ID'si

**Request Body:**
```json
{
  "title": "Updated Example",
  "description": "This is an updated example",
  "status": "inactive"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Updated Example",
    "description": "This is an updated example",
    "status": "inactive",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### DELETE /api/examples/:id
Örneği siler.

**Parameters:**
- `id` (number): Örnek ID'si

**Response:**
```json
{
  "success": true,
  "message": "Example deleted successfully",
  "data": {
    "id": 1,
    "title": "Example 1",
    "description": "This is the first example"
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation failed",
  "details": ["Name is required", "Email is required"]
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "User not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Something went wrong!",
  "message": "Internal server error"
}
```

## Test Etme

API'yi test etmek için:

```bash
# Tüm testleri çalıştır
npm test

# Testleri watch modunda çalıştır
npm run test:watch
```

## Postman Collection

Bu API'yi test etmek için Postman collection'ı oluşturabilirsiniz. Tüm endpoint'ler RESTful standartlarına uygun olarak tasarlanmıştır. 