import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './utils';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
}

export function withAuth(handler: Function) {
  return async (request: NextRequest) => {
    try {
      const token = request.cookies.get('auth-token')?.value || 
                   request.headers.get('authorization')?.replace('Bearer ', '');

      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        );
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return NextResponse.json(
          { success: false, error: 'Invalid token' },
          { status: 401 }
        );
      }

      // 요청에 사용자 정보 추가
      (request as AuthenticatedRequest).user = decoded;

      return handler(request);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}

export function withRole(roles: string[]) {
  return (handler: Function) => {
    return withAuth(async (request: AuthenticatedRequest) => {
      const user = request.user;
      
      if (!user || !roles.includes(user.role)) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      return handler(request);
    });
  };
}
