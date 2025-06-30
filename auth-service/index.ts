import dotenv from "@dotenvx/dotenvx";
dotenv.config();
import "reflect-metadata";

// Express
import express from "express";

// Middlewares
import { errorHandler } from "./src/application/middleware/error.middleware";
import morgan from "morgan";

// Controllers
import { AuthController } from "./src/infrastructure/controllers/auth.controller";
import { container } from "tsyringe";
import { JwtService } from "./src/infrastructure/services/jwt.service";
import { LoginService } from "./src/application/auth/login.service";
import MongoDBConnection from "./src/infrastructure/database/mongodb.connection";
import { MongoDBAuthRepository } from "./src/infrastructure/repositories/mongo.auth.repository";


const authController = new AuthController();

const app = express();
const PORT = process.env.PORT || 3000;


// Error handling and middlewares
app.use(errorHandler);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

{
    if (process.env.NODE_ENV === "development") {
        app.use(morgan("dev"));
    }
}
async function initializeApp() {
    const mongoClient = await MongoDBConnection.getInstance();

    // Register dependencies
    container.registerInstance("MongoClient", mongoClient);
    container.registerSingleton("MongoAuthRepository", MongoDBAuthRepository);
    container.registerSingleton("JwtService", JwtService);
    container.registerSingleton("LoginService", LoginService);
    container.registerSingleton("AuthController", AuthController);

    // Endpoints
    const authController = container.resolve(AuthController);
    app.post("/api/auth/login", authController.login.bind(authController));
    // Start the server
    app.listen(PORT, () => {
        console.log(`Server is running on port http://localhost:${PORT}`);
    });
}

initializeApp().catch((error: any) => {
    console.error("Error initializing the application:", error);
})