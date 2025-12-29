import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { JWTPayload, RoleType } from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  roleId: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: RoleType;
  };
  token: string;
}

export class AuthService {
  /**
   * Genera un token JWT para el usuario
   */
  static generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });
  }
  
  /**
   * Hashea una contraseña
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }
  
  /**
   * Verifica una contraseña
   */
  static async verifyPassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
  
  /**
   * Autentica un usuario y retorna token
   */
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { email, password } = credentials;
    
    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    if (!user.active) {
      throw new Error('User account is inactive');
    }
    
    // Verificar contraseña
    const isValidPassword = await this.verifyPassword(password, user.password);
    
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }
    
    // Generar token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role.name,
    });
    
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
      },
      token,
    };
  }
  
  /**
   * Registra un nuevo usuario (solo para CAJA en producción)
   */
  static async register(data: RegisterData): Promise<AuthResponse> {
    const { email, password, name, roleId } = data;
    
    // Verificar que el email no existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      throw new Error('Email already registered');
    }
    
    // Verificar que el rol existe
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });
    
    if (!role) {
      throw new Error('Invalid role');
    }
    
    // Hashear contraseña
    const hashedPassword = await this.hashPassword(password);
    
    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        roleId,
      },
      include: { role: true },
    });
    
    // Generar token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role.name,
    });
    
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
      },
      token,
    };
  }
  
  /**
   * Obtiene el perfil del usuario actual
   */
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      active: user.active,
      createdAt: user.createdAt,
    };
  }
}

