import { ObjectId } from "mongodb";

export interface UserAuth {
    _id: string | ObjectId;
    email?: string;
    code?: string;
    password_hash: string;
    role: string;
    is_active: boolean;
    last_login?: Date;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    userId: string;
    role: string,
    expiresIn: number;
    tokenType?: string;
}

export interface LoginRequest {
    email?: string;
    code?: string;
    password: string;
}

export interface RefreshTokenRequest {
    refresh_token: string;
}
export interface RefreshTokenResponse {
    accessToken: string;
    refreshToken: string;
    userId: string;
    role: string,
    expiresIn: number;
    tokenType?: string;
}