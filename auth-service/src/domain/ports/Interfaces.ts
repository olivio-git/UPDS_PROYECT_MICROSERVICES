export interface UserAuth {
    _id: string;
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
    role: string
}

export interface LoginRequest {
    email?: string;
    code?: string;
    password: string;
}