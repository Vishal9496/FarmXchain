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

## Seeder

If data exists:

```
[SEEDER] Seed skipped, existing products count = X
```

To reseed:

* Drop tables or DB
* Restart backend

---

## Common Errors

Unknown database

* Fix. Create DB or correct DB_URL

Cloudinary placeholder error

* Fix. Add Cloudinary variables to `.env`

403 Forbidden

* Fix. Endpoint requires JWT token

---

## Git Ignore (COPY THIS INTO `.gitignore`)

```
# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.iml
.classpath
.project
.settings/

# Node
node_modules/
dist/
build/
coverage/

# Env
.env
.env.*
*.env.local

# Java
target/
*.jar
*.class

# Logs
logs/
```

---

## `.env.example` (COPY THIS INTO `.env.example`)

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

## GitHub Push

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<username>/FarmXChain.git
git push -u origin main
```

---

## Deployment Notes

Backend

* Render or Railway
* Set env variables in dashboard
* Build. `mvn clean package`
* Run. `java -jar target/*.jar`

Frontend

* Vercel or Netlify
* Build. `npm run build`
* Set API base URL env variable

---

## Final Checklist

* Database created
* `.env` NOT committed
* `.gitignore` correct
* Backend starts without error
* Frontend loads
* GitHub repo clean
* Ready for deployment

---

## Summary

FarmXChain is a real-world, production-style full-stack project demonstrating secure backend development, database integration, image handling, and frontend interaction for agricultural traceability.

```

---

### What you do next (no guessing)

1. Paste this into `README.md`
2. Save
3. Run:
```

git add README.md .gitignore .env.example
git commit -m "Add complete project documentation"
git push


