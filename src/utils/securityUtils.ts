/**
 * Security utilities for token handling and rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    if (!entry || now > entry.resetTime) {
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  reset(identifier: string): void {
    this.limits.delete(identifier);
  }
}

export const messagingRateLimit = new RateLimiter(30, 60000); // 30 messages per minute
export const connectionRateLimit = new RateLimiter(10, 300000); // 10 connections per 5 minutes

export const logSecurityEvent = (event: {
  type: 'rate_limit_exceeded' | 'invalid_input' | 'unauthorized_access' | 'suspicious_activity';
  userId?: string;
  details?: string;
  timestamp?: Date;
}): void => {
  const logEntry = {
    ...event,
    timestamp: event.timestamp || new Date(),
    userAgent: navigator.userAgent,
    url: window.location.href
  };

  // In a production environment, this should send to a secure logging service
  console.warn('Security Event:', logEntry);
  
  // Store locally for debugging (remove in production)
  if (typeof window !== 'undefined') {
    const existingLogs = JSON.parse(localStorage.getItem('security_logs') || '[]');
    existingLogs.push(logEntry);
    
    // Keep only last 100 entries
    if (existingLogs.length > 100) {
      existingLogs.splice(0, existingLogs.length - 100);
    }
    
    localStorage.setItem('security_logs', JSON.stringify(existingLogs));
  }
};

export const obfuscateLocation = (lat: number, lng: number, precision: number = 0.01): { lat: number; lng: number } => {
  // Add random offset within precision range for location privacy
  const offsetLat = (Math.random() - 0.5) * precision;
  const offsetLng = (Math.random() - 0.5) * precision;
  
  return {
    lat: Math.round((lat + offsetLat) * 10000) / 10000,
    lng: Math.round((lng + offsetLng) * 10000) / 10000
  };
};

export const detectSuspiciousActivity = (activities: Array<{
  type: string;
  timestamp: Date;
  userId?: string;
}>): boolean => {
  if (activities.length < 5) return false;

  const recentActivities = activities.filter(
    activity => Date.now() - activity.timestamp.getTime() < 300000 // 5 minutes
  );

  // Flag if more than 20 activities in 5 minutes
  if (recentActivities.length > 20) {
    return true;
  }

  // Flag rapid consecutive actions of same type
  const actionCounts = new Map<string, number>();
  recentActivities.forEach(activity => {
    actionCounts.set(activity.type, (actionCounts.get(activity.type) || 0) + 1);
  });

  for (const [type, count] of actionCounts) {
    if (count > 10) { // More than 10 of same action type
      return true;
    }
  }

  return false;
};
