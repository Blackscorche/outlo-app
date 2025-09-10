import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VALIDATE-IAP] ${step}${detailsStr}`);
};

// Apple receipt verification URL
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';

// Google Play verification would require more complex setup with service account
// For now, we'll implement basic validation

interface SubscriptionMapping {
  type: 'subscription';
  plan: string;
}

interface ExtraMapping {
  type: 'extra';
  extra: string;
}

type ProductMapping = SubscriptionMapping | ExtraMapping;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("IAP validation started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("Missing auth header");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "No auth header" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      logStep("JSON parse failed");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid JSON" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { userId, purchase } = requestBody;
    if (!userId || !purchase) {
      logStep("Missing fields", { hasUserId: !!userId, hasPurchase: !!purchase });
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing fields" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Validating purchase", { 
      userId, 
      productId: purchase.productId,
      platform: purchase.platform 
    });

    // Validate the receipt based on platform
    let isValid = false;
    let receiptData = null;

    if (purchase.platform === 'ios') {
      // Validate with Apple
      isValid = await validateAppleReceipt(purchase.transactionReceipt);
    } else if (purchase.platform === 'android') {
      // For Android, we'll do basic validation for now
      // In production, you'd validate with Google Play Developer API
      isValid = await validateGoogleReceipt(purchase);
    }

    if (!isValid) {
      logStep("Receipt validation failed");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid receipt" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Process the purchase based on product type
    const result = await processPurchase(userId, purchase, supabaseService);
    
    logStep("Purchase processed successfully", result);

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in validate-iap-purchase", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function validateAppleReceipt(receiptData: string): Promise<boolean> {
  try {
    const payload = {
      'receipt-data': receiptData,
      'password': 'your-apple-shared-secret', // Replace with your actual Apple shared secret
      'exclude-old-transactions': false
    };

    // Try production first, then sandbox
    let response = await fetch(APPLE_PRODUCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let result = await response.json();
    
    // If production fails with sandbox receipt, try sandbox
    if (result.status === 21007) {
      response = await fetch(APPLE_SANDBOX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      result = await response.json();
    }

    logStep("Apple receipt validation", { status: result.status });
    return result.status === 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Apple validation error", { error: errorMessage });
    return false;
  }
}

async function validateGoogleReceipt(purchase: any): Promise<boolean> {
  try {
    logStep("Starting Google Play receipt validation", { 
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken ? "present" : "missing",
      transactionId: purchase.transactionId ? "present" : "missing"
    });

    // Hardcoded service account credentials
    const credentials = {
      
    };

    logStep("Using hardcoded service account credentials", {
      clientEmail: credentials.client_email,
      projectId: credentials.project_id
    });

    // Get access token for Google Play Developer API
    const accessToken = await getGooglePlayAccessToken(credentials);
    logStep("Access token result", { 
      tokenReceived: !!accessToken,
      tokenLength: accessToken ? accessToken.length : 0 
    });
    
    if (!accessToken) {
      logStep("Failed to get access token - falling back to basic validation");
      return purchase.transactionId && purchase.productId;
    }

    // Verify the purchase with Google Play Developer API
    const packageName = "com.lovemap.app"; // Hardcoded package name
    logStep("Starting Google Play verification process", {
      packageName,
      productId: purchase.productId,
      hasTransactionId: !!purchase.transactionId,
      hasPurchaseToken: !!purchase.purchaseToken,
      purchaseTokenLength: purchase.purchaseToken?.length || 0,
      transactionId: purchase.transactionId || "not provided",
      platform: purchase.platform
    });
    
    const isValid = await verifyGooglePlayPurchase(
      accessToken,
      packageName,
      purchase.productId,
      purchase.purchaseToken
    );

    logStep("Google Play validation result", { 
      isValid, 
      productId: purchase.productId,
      usedFallback: !accessToken 
    });
    
    return isValid;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("Google validation error - falling back to basic validation", { 
      error: errorMessage,
      stack: errorStack 
    });
    
    // Fallback to basic validation
    const basicValid = purchase.transactionId && purchase.productId;
    logStep("Basic validation result", { basicValid });
    return basicValid;
  }
}

async function processPurchase(userId: string, purchase: any, supabaseService: any) {
  const { productId, transactionId, transactionDate } = purchase;
  
  // Map IAP product IDs to your existing system
  const productMapping: Record<string, ProductMapping> = {
    'lovemap_premium_monthly': { type: 'subscription', plan: 'premium_monthly' },
    'lovemap_premium_yearly': { type: 'subscription', plan: 'premium_yearly' },
    'lovemap_connection_request': { type: 'extra', extra: 'connection_request' },
    'lovemap_first_impression': { type: 'extra', extra: 'first_impression' },
    'lovemap_invisible_mode': { type: 'extra', extra: 'invisible_mode' }
  };

  const mapping = productMapping[productId];
  if (!mapping) {
    throw new Error(`Unknown product ID: ${productId}`);
  }

  if (mapping.type === 'subscription') {
    // Handle subscription - TypeScript now knows this is a SubscriptionMapping
    await supabaseService
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        tier: 'premium',
        billing_period: mapping.plan.includes('yearly') ? 'yearly' : 'monthly',
        status: 'active',
        iap_transaction_id: transactionId,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + (mapping.plan.includes('yearly') ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    // Update quotas
    const planFeatures = mapping.plan.includes('yearly') ? 
      { connectionRequests: 10, firstImpressions: 3 } : 
      { connectionRequests: 10, firstImpressions: 3 };

    await supabaseService
      .from('user_quotas')
      .upsert({
        user_id: userId,
        connection_requests_remaining: planFeatures.connectionRequests,
        first_impressions_remaining: planFeatures.firstImpressions,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

  } else if (mapping.type === 'extra') {
    // Handle extra purchase - TypeScript now knows this is an ExtraMapping
    const { data: quotas } = await supabaseService
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!quotas) {
      throw new Error('User quotas not found');
    }

    const updates: any = { updated_at: new Date().toISOString() };

    switch (mapping.extra) {
      case 'connection_request':
        updates.connection_requests_purchased = (quotas.connection_requests_purchased || 0) + 1;
        break;
      case 'first_impression':
        updates.first_impressions_purchased = (quotas.first_impressions_purchased || 0) + 1;
        break;
      case 'invisible_mode':
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        updates.invisible_mode_expires_at = expiresAt.toISOString();
        break;
    }

    await supabaseService
      .from('user_quotas')
      .update(updates)
      .eq('user_id', userId);
  }

  // Record purchase in history
  await supabaseService
    .from('purchase_history')
    .insert({
      user_id: userId,
      product_type: mapping.type === 'subscription' ? mapping.plan : mapping.extra,
      quantity: 1,
      amount_cents: getProductPrice(productId),
      currency: 'USD',
      iap_transaction_id: transactionId,
      iap_receipt_data: JSON.stringify(purchase),
      platform: purchase.platform,
      status: 'completed',
      created_at: new Date().toISOString(),
    });

  return { 
    productId, 
    type: mapping.type,
    processed: true 
  };
}

function getProductPrice(productId: string): number {
  const prices = {
    'lovemap_premium_monthly': 1499, // $14.99
    'lovemap_premium_yearly': 14400,  // $144
    'lovemap_connection_request': 100, // $1.00
    'lovemap_first_impression': 199,   // $1.99
    'lovemap_invisible_mode': 499,     // $4.99
  };
  return prices[productId as keyof typeof prices] || 0;
}

// Google Play Developer API functions
async function getGooglePlayAccessToken(credentials: any): Promise<string | null> {
  try {
    logStep("Creating Google Play API access token with JWT");

    // Validate credentials first
    if (!credentials.client_email || !credentials.private_key) {
      logStep("Missing required credentials", {
        hasClientEmail: !!credentials.client_email,
        hasPrivateKey: !!credentials.private_key
      });
      return null;
    }

    // Create JWT payload with correct scope
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600, // 1 hour
    };

    logStep("JWT payload created", {
      iss: payload.iss,
      scope: payload.scope,
      iat: payload.iat,
      exp: payload.exp,
      timeUntilExpiry: payload.exp - now
    });

    // Create JWT header
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    // Base64URL encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    logStep("JWT components created", {
      headerLength: encodedHeader.length,
      payloadLength: encodedPayload.length,
      unsignedTokenLength: unsignedToken.length
    });

    // Import private key for signing
    let privateKey;
    try {
      privateKey = await importPrivateKey(credentials.private_key);
      logStep("Private key imported successfully");
    } catch (keyError) {
      const keyErrorMessage = keyError instanceof Error ? keyError.message : String(keyError);
      logStep("Private key import failed", { error: keyErrorMessage });
      return null;
    }
    
    // Sign the token
    let signature;
    try {
      signature = await signJWT(unsignedToken, privateKey);
      logStep("JWT signed successfully", { signatureLength: signature.length });
    } catch (signError) {
      const signErrorMessage = signError instanceof Error ? signError.message : String(signError);
      logStep("JWT signing failed", { error: signErrorMessage });
      return null;
    }

    const jwt = `${unsignedToken}.${signature}`;
    logStep("Final JWT created", { jwtLength: jwt.length });

    // Exchange JWT for access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    });

    logStep("Requesting access token from Google", {
      endpoint: 'https://oauth2.googleapis.com/token',
      bodyLength: tokenRequestBody.toString().length
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'LoveMapApp/1.0'
      },
      body: tokenRequestBody,
    });

    const responseText = await tokenResponse.text();
    logStep("Google token response received", { 
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      responseLength: responseText.length,
      headers: Object.fromEntries(tokenResponse.headers.entries())
    });

    if (!tokenResponse.ok) {
      logStep("Google token exchange failed - detailed error", { 
        status: tokenResponse.status, 
        statusText: tokenResponse.statusText,
        error: responseText,
        isClientError: tokenResponse.status >= 400 && tokenResponse.status < 500,
        isServerError: tokenResponse.status >= 500
      });
      
      // Try to parse error for more details
      try {
        const errorData = JSON.parse(responseText);
        logStep("Parsed error details", {
          errorType: errorData.error,
          errorDescription: errorData.error_description
        });
      } catch (e) {
        logStep("Could not parse error response as JSON");
      }
      
      return null;
    }

    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (parseError) {
      logStep("Failed to parse token response", { responseText });
      return null;
    }

    if (!tokenData.access_token) {
      logStep("No access token in response", tokenData);
      return null;
    }

    logStep("Google Play access token obtained successfully", {
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      tokenLength: tokenData.access_token.length,
      scope: tokenData.scope || 'not provided'
    });
    
    return tokenData.access_token;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("Error getting Google Play access token", { 
      error: errorMessage,
      stack: errorStack 
    });
    return null;
  }
}

// Helper function to base64url encode
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Import RSA private key for signing
async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  // Remove PEM header/footer and whitespace
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  
  // Convert base64 to ArrayBuffer
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  // Import the key
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

// Sign JWT with RSA-SHA256
async function signJWT(data: string, privateKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    encoder.encode(data)
  );
  
  // Convert signature to base64url
  const signatureArray = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  return signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function verifyGooglePlayPurchase(
  accessToken: string,
  packageName: string,
  productId: string,
  purchaseToken: string
): Promise<boolean> {
  try {
    // Determine if this is a subscription or a product
    const isSubscription = productId.includes('monthly') || productId.includes('yearly') || productId.includes('premium');
    
    let url: string;
    if (isSubscription) {
      url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    } else {
      url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;
    }
    
    logStep("Attempting Google Play verification", { 
      url, 
      isSubscription,
      productId,
      packageName,
      tokenLength: purchaseToken.length,
      accessTokenLength: accessToken.length,
      accessTokenPrefix: accessToken.substring(0, 20) + "..."
    });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'LoveMapApp/1.0',
      },
    });

    const responseText = await response.text();
    
    logStep("Google Play API response details", { 
      status: response.status, 
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      responseBody: responseText,
      responseLength: responseText.length
    });

    if (!response.ok) {
      logStep("Google Play API error - detailed analysis", { 
        status: response.status, 
        statusText: response.statusText,
        body: responseText,
        isUnauthorized: response.status === 401,
        isForbidden: response.status === 403,
        isNotFound: response.status === 404
      });
      
      // Try alternative approaches based on error type
      if (response.status === 401) {
        logStep("401 Unauthorized - checking token and trying direct validation");
        
        // Log more details about the token
        try {
          const tokenPayload = JSON.parse(atob(accessToken.split('.')[1]));
          logStep("Token payload analysis", {
            iss: tokenPayload.iss,
            scope: tokenPayload.scope,
            aud: tokenPayload.aud,
            exp: tokenPayload.exp,
            currentTime: Math.floor(Date.now() / 1000),
            isExpired: tokenPayload.exp < Math.floor(Date.now() / 1000)
          });
        } catch (e) {
          logStep("Could not parse token payload - token might be malformed");
        }
        
        return false;
      }
      
      if (response.status === 404) {
        logStep("404 Not Found - purchase might not exist or package name wrong");
        return false;
      }
      
      // If subscription endpoint fails, try product endpoint as fallback
      if (isSubscription && (response.status === 403 || response.status === 400)) {
        logStep("Trying product endpoint as fallback for subscription");
        const productUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;
        
        const productResponse = await fetch(productUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'LoveMapApp/1.0',
          },
        });
        
        const productResponseText = await productResponse.text();
        logStep("Product endpoint fallback response", { 
          status: productResponse.status,
          body: productResponseText 
        });
        
        if (!productResponse.ok) {
          return false;
        }
        
        const productData = JSON.parse(productResponseText);
        logStep("Google Play product verification successful", { 
          purchaseState: productData.purchaseState,
          consumptionState: productData.consumptionState 
        });
        
        return productData.purchaseState === 0;
      }
      
      return false;
    }

    const data = JSON.parse(responseText);
    logStep("Google Play verification successful", { 
      purchaseState: data.purchaseState,
      consumptionState: data.consumptionState,
      isSubscription,
      fullResponse: data
    });

    // purchaseState: 0 = Purchased, 1 = Canceled
    return data.purchaseState === 0;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("Error verifying Google Play purchase", { 
      error: errorMessage,
      stack: errorStack 
    });
    return false;
  }
}
