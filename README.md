# FarmXChain – Backend Developer Intern Assignment

## 📌 Project Overview
FarmXChain is a secure, scalable full-stack application built using Spring Boot and React.  
It implements JWT-based authentication, role-based access control, and secure CRUD operations.

This project demonstrates backend security, API design, and frontend integration.

---

## 🛠 Tech Stack

Backend:
- Java 21
- Spring Boot 3.5.5
- Spring Security
- JWT Authentication
- MySQL
- JPA / Hibernate

Frontend:
- React.js
- Axios

---

## 🔐 Features Implemented

- User Registration & Login
- Password hashing using BCrypt
- JWT Authentication
- Role-Based Access Control (USER / ADMIN)
- Protected APIs
- CRUD Operations for Products
- Input Validation
- Global Exception Handling
- Clean Project Structure (Controller → Service → Repository)
- Application Startup Logs Included

---

## 🚀 How to Run the Project

### 1️⃣ Backend Setup

1. Create MySQL database:
   farmxchain

2. Update database credentials in:
   backend/src/main/resources/application.properties

3. Navigate to backend folder:

   cd backend

4. Run application:

   mvn spring-boot:run

Backend runs on:
http://localhost:8080

---

### 2️⃣ Frontend Setup

1. Navigate to frontend folder:

   cd frontend

2. Install dependencies:

   npm install

3. Start frontend:

   npm start

Frontend runs on:
http://localhost:3000

---

## 🔑 Sample Credentials

Admin:
email: admin@test.com  
password: Admin@123  

User:
email: user@test.com  
password: User@123  

---

## 📄 API Documentation

Swagger UI (if enabled):
http://localhost:8080/swagger-ui/index.html

---

## 📈 Scalability Considerations

- Stateless JWT authentication allows horizontal scaling.
- Application can be deployed behind a load balancer.
- Redis caching can be added for performance optimization.
- Authentication module can be separated into microservices for large-scale systems.

---

## 📂 Repository Structure

FarmXChain  
├── backend  
├── frontend  
├── application-startup.log  

---

## 👤 Author

Vishal Kothimire  
Backend Developer Intern Assignment Submission
