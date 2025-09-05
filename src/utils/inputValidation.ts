
import { sanitizeInput } from './securityEnhancements';

/**
 * Enhanced input validation and sanitization utilities
 */

export const validateMessageContent = (content: string): { isValid: boolean; error?: string } => {
  if (!content || typeof content !== 'string') {
    return { isValid: false, error: 'Message content is required' };
  }

  const trimmedContent = content.trim();
  
  if (trimmedContent.length === 0) {
    return { isValid: false, error: 'Message cannot be empty' };
  }

  if (trimmedContent.length > 1000) {
    return { isValid: false, error: 'Message too long (max 1000 characters)' };
  }

  // Enhanced security patterns
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi,
    /<iframe/gi,
    /<embed/gi,
    /<object/gi,
    /document\.cookie/gi,
    /document\.write/gi,
    /window\.location/gi,
    /fromCharCode/gi
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmedContent)) {
      return { isValid: false, error: 'Message contains prohibited content' };
    }
  }

  // Check for potential SQL injection patterns
  const sqlPatterns = [
    /('|(\\')|(\\\\))\s*(;|'|"|\\|or|and|union|select|insert|delete|update|create|drop|exec|execute)/gi,
    /\bunion\s+select/gi,
    /\bselect\s+.*\bfrom\b/gi,
    /\binsert\s+into/gi,
    /\bdelete\s+from/gi,
    /\bdrop\s+table/gi
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(trimmedContent)) {
      return { isValid: false, error: 'Message contains prohibited patterns' };
    }
  }

  return { isValid: true };
};

export const validateProfileData = (data: {
  name?: string;
  bio?: string;
  age?: number;
  [key: string]: any;
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (data.name !== undefined) {
    if (typeof data.name !== 'string') {
      errors.push('Name must be a string');
    } else {
      const sanitizedName = sanitizeInput(data.name);
      if (sanitizedName.length === 0) {
        errors.push('Name cannot be empty');
      } else if (sanitizedName.length > 50) {
        errors.push('Name too long (max 50 characters)');
      } else if (!/^[a-zA-Z\s\-'\.]+$/.test(sanitizedName)) {
        errors.push('Name contains invalid characters');
      }
    }
  }

  if (data.bio !== undefined) {
    if (typeof data.bio !== 'string') {
      errors.push('Bio must be a string');
    } else {
      const sanitizedBio = sanitizeInput(data.bio);
      if (sanitizedBio.length > 500) {
        errors.push('Bio too long (max 500 characters)');
      }
    }
  }

  if (data.age !== undefined) {
    if (typeof data.age !== 'number' || !Number.isInteger(data.age)) {
      errors.push('Age must be a valid number');
    } else if (data.age < 18 || data.age > 100) {
      errors.push('Age must be between 18 and 100');
    }
  }

  // Validate other string fields
  const stringFields = ['occupation', 'education', 'company', 'jobTitle', 'school', 'livingIn'];
  stringFields.forEach(field => {
    if (data[field] !== undefined) {
      if (typeof data[field] !== 'string') {
        errors.push(`${field} must be a string`);
      } else {
        const sanitized = sanitizeInput(data[field]);
        if (sanitized.length > 100) {
          errors.push(`${field} too long (max 100 characters)`);
        }
      }
    }
  });

  // Validate arrays
  if (data.interests !== undefined) {
    if (!Array.isArray(data.interests)) {
      errors.push('Interests must be an array');
    } else if (data.interests.length > 20) {
      errors.push('Too many interests (max 20)');
    } else {
      data.interests.forEach((interest, index) => {
        if (typeof interest !== 'string') {
          errors.push(`Interest ${index + 1} must be a string`);
        } else if (sanitizeInput(interest).length > 50) {
          errors.push(`Interest ${index + 1} too long (max 50 characters)`);
        }
      });
    }
  }

  return { isValid: errors.length === 0, errors };
};

export const validateFileUpload = (file: File): { isValid: boolean; error?: string } => {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp'
  ];

  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }

  if (file.size > maxSize) {
    return { isValid: false, error: 'File too large (max 5MB)' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Invalid file type (only JPEG, PNG, WebP allowed)' };
  }

  // Enhanced filename validation
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(file.name)) {
    return { isValid: false, error: 'Invalid filename. Use only letters, numbers, dots, underscores, and hyphens (max 100 chars)' };
  }

  // Check for double extensions (potential security risk)
  const parts = file.name.split('.');
  if (parts.length > 2) {
    return { isValid: false, error: 'Multiple file extensions not allowed' };
  }

  // Check for potentially dangerous extensions
  const dangerousExtensions = [
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 'php', 'asp', 'aspx'
  ];
  
  const extension = parts[parts.length - 1]?.toLowerCase();
  if (extension && dangerousExtensions.includes(extension)) {
    return { isValid: false, error: 'File extension not allowed for security reasons' };
  }

  return { isValid: true };
};

// Enhanced email validation
export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const sanitizedEmail = sanitizeInput(email.toLowerCase().trim());
  
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(sanitizedEmail)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  if (sanitizedEmail.length > 254) {
    return { isValid: false, error: 'Email too long (max 254 characters)' };
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\+.*\+/, // Multiple plus signs
    /\.{2,}/, // Multiple consecutive dots
    /@.*@/, // Multiple @ symbols
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitizedEmail)) {
      return { isValid: false, error: 'Email contains invalid patterns' };
    }
  }

  return { isValid: true };
};

// Phone number validation (international format)
export const validatePhoneNumber = (phone: string): { isValid: boolean; error?: string } => {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }

  const sanitizedPhone = phone.replace(/\s+/g, '').replace(/[-()]/g, '');
  
  // Basic international phone number format
  const phoneRegex = /^\+?[1-9]\d{6,14}$/;
  
  if (!phoneRegex.test(sanitizedPhone)) {
    return { isValid: false, error: 'Invalid phone number format' };
  }

  return { isValid: true };
};

export const sanitizeHtml = (input: string): string => {
  return sanitizeInput(input);
};
