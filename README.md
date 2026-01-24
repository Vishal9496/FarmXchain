# FarmXChain

FarmXChain is a full-stack web application that tracks agricultural produce from farm to consumer.  
It ensures transparency and traceability by recording every stage in a product’s lifecycle.

Farmers, distributors, and retailers log product events.  
Consumers can verify product origin and journey.

## Tech Stack

Frontend
- React.js
- Tailwind CSS
- JavaScript

Backend
- Java 21
- Spring Boot
- Spring Data JPA
- Spring Security
- JWT Authentication

Database
- MySQL 8+

Other Services
- Cloudinary for image storage

---

## Features

- User registration and authentication
- Role-based access control
- Product and batch tracking
- Supply chain event timeline
- Image uploads
- Password reset with token
- Seeder for demo data

---

## Project Structure

```

FarmXChain/
├─ backend/              # Spring Boot backend
├─ src/                  # React frontend
├─ public/
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md

````

---

## Prerequisites

- Java 21+
- Maven
- Node.js 18+
- MySQL 8+
- Git

---

## Database Setup

Create database:

```sql
CREATE DATABASE farmxchain_auth
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
````

Optional user:

```sql
CREATE USER 'farmuser'@'localhost' IDENTIFIED BY 'password123';
GRANT ALL PRIVILEGES ON farmxchain_auth.* TO 'farmuser'@'localhost';
FLUSH PRIVILEGES;
```

---

## Environment Variables

Create a `.env` file at project root.
Never commit this file.

```
DB_URL=jdbc:mysql://localhost:3306/farmxchain_auth
DB_USERNAME=farmuser
DB_PASSWORD=password123

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRATION_MS=3600000
```

---

## Backend Setup

```bash
cd backend
mvn clean install
mvn spring-boot:run
```

Backend runs on:

```
http://localhost:8080
```

Successful startup log:

```
Tomcat started on port 8080
Started FarmxchainAuthApplication
```

---

## Frontend Setup

```bash
npm install
npm run dev
```

Frontend runs on:

```
http://localhost:3000
```

---

## Key API Endpoints

Base URL:

```
http://localhost:8080/api
```

Auth:

* POST `/auth/register`
* POST `/auth/login`
* POST `/auth/forgot-password`
* POST `/auth/reset-password`

Products:

* GET `/products`
* POST `/products`

Example:

```bash
curl http://localhost:8080/api/products
```

---

## Password Reset Flow

1. User sends email to `/auth/forgot-password`
2. Backend creates token and logs reset link
3. Open link in browser
4. Submit new password to `/auth/reset-password`

---
