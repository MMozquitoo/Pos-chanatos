import { prisma } from '../config/database';
import { RoleType } from '../types';
import { AuditService } from './audit.service';
import { AuditAction } from '@prisma/client';

export interface OpenCashSessionData {
  initialCash: number;
  notes?: string;
}

export interface CloseCashSessionData {
  finalCash: number;
  notes?: string;
}

export class CashService {
  /**
   * Verifica si hay una sesión de caja abierta para un usuario
   */
  static async getActiveSession(userId: string) {
    const session = await prisma.cashSession.findFirst({
      where: {
        userId,
        closedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payments: {
          include: {
            order: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: {
        openedAt: 'desc',
      },
    });
    
    return session;
  }
  
  /**
   * Verifica si hay una sesión de caja abierta (cualquier usuario)
   * Útil para validar antes de crear pagos
   */
  static async getAnyActiveSession() {
    const session = await prisma.cashSession.findFirst({
      where: {
        closedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        openedAt: 'desc',
      },
    });
    
    return session;
  }
  
  /**
   * Abre una nueva sesión de caja
   * Solo CAJA puede abrir sesiones
   */
  static async openSession(
    userId: string,
    data: OpenCashSessionData,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Verificar que sea CAJA
    if (userRole !== RoleType.CAJA) {
      throw new Error('Only CAJA role can open cash sessions');
    }
    
    // Verificar que no haya una sesión abierta para este usuario
    const activeSession = await this.getActiveSession(userId);
    if (activeSession) {
      throw new Error('User already has an active cash session');
    }
    
    // Validar initialCash
    if (data.initialCash < 0) {
      throw new Error('Initial cash cannot be negative');
    }
    
    // Crear sesión
    const session = await prisma.cashSession.create({
      data: {
        userId,
        initialCash: data.initialCash,
        notes: data.notes,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    // Log de auditoría
    await AuditService.logCashOpen(
      userId,
      data.initialCash,
      session.id,
      ipAddress,
      userAgent
    );
    
    return session;
  }
  
  /**
   * Cierra una sesión de caja
   * Solo CAJA puede cerrar sesiones
   */
  static async closeSession(
    userId: string,
    sessionId: string,
    data: CloseCashSessionData,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Verificar que sea CAJA
    if (userRole !== RoleType.CAJA) {
      throw new Error('Only CAJA role can close cash sessions');
    }
    
    // Obtener sesión
    const session = await prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        payments: true,
      },
    });
    
    if (!session) {
      throw new Error('Cash session not found');
    }
    
    // Verificar que la sesión pertenezca al usuario
    if (session.userId !== userId) {
      throw new Error('Cannot close another user\'s cash session');
    }
    
    // Verificar que no esté ya cerrada
    if (session.closedAt) {
      throw new Error('Cash session is already closed');
    }
    
    // Validar finalCash
    if (data.finalCash < 0) {
      throw new Error('Final cash cannot be negative');
    }
    
    // Cerrar sesión
    const closedSession = await prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        closedAt: new Date(),
        finalCash: data.finalCash,
        notes: data.notes,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payments: {
          include: {
            order: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
    });
    
    // Log de auditoría
    await AuditService.logCashClose(
      userId,
      data.finalCash,
      sessionId,
      ipAddress,
      userAgent
    );
    
    return closedSession;
  }
  
  /**
   * Obtiene todas las sesiones de caja de un usuario
   */
  static async getUserSessions(userId: string, userRole: RoleType) {
    // Solo CAJA puede ver sesiones
    if (userRole !== RoleType.CAJA) {
      throw new Error('Only CAJA role can view cash sessions');
    }
    
    const sessions = await prisma.cashSession.findMany({
      where: {
        userId,
      },
      include: {
        payments: {
          include: {
            order: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: {
        openedAt: 'desc',
      },
    });
    
    return sessions;
  }
  
  /**
   * Obtiene una sesión por ID
   */
  static async getSessionById(sessionId: string, userRole: RoleType) {
    // Solo CAJA puede ver sesiones
    if (userRole !== RoleType.CAJA) {
      throw new Error('Only CAJA role can view cash sessions');
    }
    
    const session = await prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payments: {
          include: {
            order: {
              select: {
                id: true,
                status: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    if (!session) {
      throw new Error('Cash session not found');
    }
    
    return session;
  }
}

