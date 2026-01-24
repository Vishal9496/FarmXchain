# 🌾 FarmChainX - AI-Driven Agricultural Traceability Network

![Frontend](https://img.shields.io/badge/Frontend-React-blue)
![Backend](https://img.shields.io/badge/Backend-SpringBoot-brightgreen)
![Database](https://img.shields.io/badge/Database-MySQL-orange)

FarmChainX is a full-stack platform for **tracking agricultural produce** with AI-based tools. It enables farmers, distributors, and consumers to monitor the journey of agricultural products, ensuring **transparency and traceability** in the supply chain.

---

## 📂 Project Structure

FarmChainX-AI-Driven-Agricultural-Traceability-Network/
│
├─ frontend/ # React frontend
└─ backend/ # Spring Boot backend (Eclipse project)

# <<<<<<< HEAD

yaml
Copy code

> > > > > > > 8c690be (Updated UI)

---

## ⚙️ Tech Stack

- **Frontend:** React.js, JavaScript, HTML, CSS
- **Backend:** Java, Spring Boot, Maven
- **Database:** MySQL
- **Tools:** Eclipse IDE, Node.js, npm, Git

---

## 🚀 Getting Started

### Frontend (React)

1. Open terminal in the `frontend` folder:

```

## 🔐 Secret Management
- No API keys or passwords are committed. Copy `.env.example` to `.env` and fill values locally; keep `.env` untracked.
- Backend environment variables: `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `SERVER_PORT`.
- Frontend talks to the backend only (`REACT_APP_API_BASE_URL`); do not expose Gemini keys in the browser.
- GitHub Actions: store the above variables as repository secrets (Settings → Secrets and variables → Actions).
- Production: provision the same variables via your platform secret manager (e.g., Kubernetes secrets, AWS SSM/Secrets Manager, Azure Key Vault) and never bake them into images or configs.
- Key rotation: create a new Gemini key in the provider console, update the secret manager and `.env`, restart services, then revoke the old key. To scrub historical leaks, rewrite git history with `git filter-repo` or BFG and force-push, then rotate keys again.
bash
<<<<<<< HEAD

=======
cd frontend
>>>>>>> 8c690be (Updated UI)
Install dependencies:

"""
npm install
Start the development server:
""
npm start
Open http://localhost:3000 in your browser.

Backend (Spring Boot / Eclipse)
Open Eclipse IDE and import the backend folder as an existing Maven project.

Configure MySQL database in application.properties:

properties

spring.datasource.url=jdbc:mysql://localhost:3306/farmxchain
spring.datasource.username=root
spring.datasource.password=your_password
spring.jpa.hibernate.ddl-auto=update
Create the database:

CREATE DATABASE farmxchain;
Run FarmxchainAuthApplication.java as a Java Application. The backend will start on http://localhost:8080.

🔄 Running the Full Application
Start MySQL.

Run the backend in Eclipse.

Run the frontend (npm start).

Access the app at http://localhost:3000.
The frontend communicates with backend APIs at http://localhost:8080.



💡 Notes
Ensure ports 3000 (frontend) and 8080 (backend) are free.

<<<<<<< HEAD
The backend must be running for the frontend features to work properly.
=======
The backend must be running for the frontend features to work properly.
>>>>>>> 8c690be (Updated UI)
```
