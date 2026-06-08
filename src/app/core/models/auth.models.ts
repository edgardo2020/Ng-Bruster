export type UserRole = 'Trainer' | 'Trainee' | 'Receptionist';

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  roles: UserRole[];
  idRol?: number;
  idEmpresa?: number;
  avatarUrl?: string;
  gymName?: string;
  membershipStatus?: 'Active' | 'Inactive' | 'Pending';
  active?: boolean;
  expiredTime?: string;
}

export interface AuthSession {
  token: string;
  user: CurrentUser;
  expiresAt?: string;
}

export interface LoginRequest {
  usuario: string;
  password: string;
}

export type LoginDto = LoginRequest;

export interface LoginResponse {
  token: string;
  expiresAt?: string;
  user?: Partial<CurrentUser>;
}

export type LoginResponseDto = LoginResponse;

export interface LoginApiResponse {
  exito: boolean;
  mensaje: string;
  respuesta: LoginApiUser | null;
}

export interface LoginApiUser {
  idUser: number;
  usuario: string;
  password: string;
  newPassword: string | null;
  idRol: number;
  idUbicacion: number;
  nombre: string;
  telefono: string;
  correo: string;
  token: string;
  ultimoAcceso: string;
  visible: boolean;
  idEmpresa: number;
  expiredTime: string;
  membershipStatus?: 'Active' | 'Inactive' | 'Pending';
}

export const ROL_MAP: Record<number, UserRole> = {
  1: 'Trainer',
  2: 'Trainee',
  3: 'Receptionist'
};