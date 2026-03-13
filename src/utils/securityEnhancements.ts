/**
 * Enhanced security utilities with additional protections
 */

import { supabase } from '../integrations/supabase/client';

interface SecurityConfig {
  maxLoginAttempts: number;
  lockoutDuration: number; // in minutes
  sessionTimeout: number; // in hours
  passwordMinLength: number;
}

const SECURITY_CONFIG: SecurityConfig = {
  maxLoginAttempts: 5,
  lockoutDuration: 30,
  sessionTimeout: 24,
  passwordMinLength: 8
};

interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

class SecurityManager {
  private loginAttempts: Map<string, LoginAttempt> = new Map();

  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < SECURITY_CONFIG.passwordMinLength) {
      errors.push(`Password must be at least ${SECURITY_CONFIG.passwordMinLength} characters long`);
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return { isValid: errors.length === 0, errors };
  }

  isAccountLocked(identifier: string): boolean {
    const attempt = this.loginAttempts.get(identifier);
    if (!attempt || !attempt.lockedUntil) return false;

    if (Date.now() > attempt.lockedUntil) {
      // Lock expired, reset attempts
      this.loginAttempts.delete(identifier);
      return false;
    }

    return true;
  }

  recordLoginAttempt(identifier: string, success: boolean): void {
    const now = Date.now();
    const attempt = this.loginAttempts.get(identifier) || { count: 0, lastAttempt: now };

    if (success) {
      // Reset on successful login
      this.loginAttempts.delete(identifier);
      return;
    }

    attempt.count++;
    attempt.lastAttempt = now;

    if (attempt.count >= SECURITY_CONFIG.maxLoginAttempts) {
      attempt.lockedUntil = now + (SECURITY_CONFIG.lockoutDuration * 60 * 1000);
      this.logSecurityEvent({
        type: 'account_locked',
        details: `Account locked after ${attempt.count} failed attempts`,
        identifier
      });
    }

    this.loginAttempts.set(identifier, attempt);
  }

  getTimeUntilUnlock(identifier: string): number {
    const attempt = this.loginAttempts.get(identifier);
    if (!attempt || !attempt.lockedUntil) return 0;

    const remaining = attempt.lockedUntil - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 60000) : 0; // minutes
  }

  private logSecurityEvent(event: {
    type: string;
    details: string;
    identifier?: string;
  }): void {
    console.warn('Security Event:', {
      ...event,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });

    // Store in localStorage for debugging (remove in production)
    if (typeof window !== 'undefined') {
      const existingLogs = JSON.parse(localStorage.getItem('security_events') || '[]');
      existingLogs.push({
        ...event,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 50 entries
      if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50);
      }
      
      localStorage.setItem('security_events', JSON.stringify(existingLogs));
    }
  }

  // Enhanced location obfuscation with multiple precision levels
  obfuscateLocation(
    lat: number, 
    lng: number, 
    precisionLevel: 'high' | 'medium' | 'low' = 'medium'
  ): { lat: number; lng: number } {
    const precisionMap = {
      high: 0.001,   // ~100m radius
      medium: 0.01,  // ~1km radius  
      low: 0.05      // ~5km radius
    };

    const precision = precisionMap[precisionLevel];
    const offsetLat = (Math.random() - 0.5) * precision;
    const offsetLng = (Math.random() - 0.5) * precision;
    
    return {
      lat: Math.round((lat + offsetLat) * 100000) / 100000,
      lng: Math.round((lng + offsetLng) * 100000) / 100000
    };
  }

  // Check if user has proper connection access
  async validateChatRoomAccess(roomId: string, userId: string): Promise<boolean> {
    try {
      const { data: room, error } = await supabase
        .from('chat_rooms')
        .select('user1_id, user2_id')
        .eq('id', roomId)
        .single();

      if (error || !room) {
        this.logSecurityEvent({
          type: 'unauthorized_chat_access',
          details: `User ${userId} attempted to access non-existent room ${roomId}`
        });
        return false;
      }

      const hasAccess = room.user1_id === userId || room.user2_id === userId;
      
      if (!hasAccess) {
        this.logSecurityEvent({
          type: 'unauthorized_chat_access',
          details: `User ${userId} attempted to access unauthorized room ${roomId}`
        });
      }

      return hasAccess;
    } catch (error) {
      this.logSecurityEvent({
        type: 'chat_access_error',
        details: `Error validating chat room access: ${error}`
      });
      return false;
    }
  }

  // Validate file uploads with enhanced security
  validateFileUpload(file: File): { isValid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp'
    ];

    // Check file size
    if (file.size > maxSize) {
      return { isValid: false, error: 'File too large (max 5MB)' };
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: 'Invalid file type (only JPEG, PNG, WebP allowed)' };
    }

    // Enhanced filename validation
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(file.name)) {
      return { isValid: false, error: 'Invalid filename. Use only letters, numbers, dots, underscores, and hyphens' };
    }

    // Check for double extensions (potential security risk)
    const parts = file.name.split('.');
    if (parts.length > 2) {
      return { isValid: false, error: 'Multiple file extensions not allowed' };
    }

    return { isValid: true };
  }

  // Enhanced suspicious activity detection
  detectSuspiciousActivity(activities: Array<{
    type: string;
    timestamp: Date;
    userId?: string;
    metadata?: any;
  }>): { isSuspicious: boolean; reason?: string } {
    if (activities.length < 3) return { isSuspicious: false };

    const recentActivities = activities.filter(
      activity => Date.now() - activity.timestamp.getTime() < 300000 // 5 minutes
    );

    // Check for rapid succession of same activity
    const activityCounts = new Map<string, number>();
    recentActivities.forEach(activity => {
      const key = `${activity.type}_${activity.userId}`;
      activityCounts.set(key, (activityCounts.get(key) || 0) + 1);
    });

    for (const [key, count] of activityCounts) {
      if (count > 10) {
        return { 
          isSuspicious: true, 
          reason: `More than 10 ${key.split('_')[0]} actions in 5 minutes` 
        };
      }
    }

    // Check for rapid account switching (multiple user IDs from same session)
    const uniqueUsers = new Set(recentActivities.map(a => a.userId).filter(Boolean));
    if (uniqueUsers.size > 3) {
      return { 
        isSuspicious: true, 
        reason: 'Multiple user accounts accessed in short time period' 
      };
    }

    return { isSuspicious: false };
  }
}

export const securityManager = new SecurityManager();

// Enhanced input sanitization
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
};

// Rate limiting with IP tracking
interface RateLimitEntry {
  count: number;
  resetTime: number;
  ips: Set<string>;
}

class EnhancedRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private ipLimits: Map<string, RateLimitEntry> = new Map();

  isAllowed(identifier: string, ip?: string): boolean {
    const now = Date.now();
    
    // Check user-based rate limit
    const userAllowed = this.checkUserLimit(identifier, now, ip);
    
    // Check IP-based rate limit if IP is provided
    const ipAllowed = ip ? this.checkIPLimit(ip, now) : true;
    
    return userAllowed && ipAllowed;
  }

  private checkUserLimit(identifier: string, now: number, ip?: string): boolean {
    const entry = this.limits.get(identifier);

    if (!entry || now > entry.resetTime) {
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + 60000, // 1 minute
        ips: new Set(ip ? [ip] : [])
      });
      return true;
    }

    if (ip) entry.ips.add(ip);

    if (entry.count >= 30) { // 30 requests per minute per user
      return false;
    }

    entry.count++;
    return true;
  }

  private checkIPLimit(ip: string, now: number): boolean {
    const entry = this.ipLimits.get(ip);

    if (!entry || now > entry.resetTime) {
      this.ipLimits.set(ip, {
        count: 1,
        resetTime: now + 60000, // 1 minute
        ips: new Set([ip])
      });
      return true;
    }

    if (entry.count >= 100) { // 100 requests per minute per IP
      return false;
    }

    entry.count++;
    return true;
  }
}

export const enhancedRateLimit = new EnhancedRateLimiter();
