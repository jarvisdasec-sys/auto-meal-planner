/**
 * Kroger API integration for fetching real product images.
 * Uses OAuth 2.0 client credentials flow to authenticate with Kroger's API.
 */

const KROGER_BASE_URL = 'https://api.kroger.com/v1';
const KROGER_AUTH_URL = 'https://api.kroger.com/v1/connect/oauth2/authorize';
const KROGER_TOKEN_URL = 'https://api.kroger.com/v1/connect/oauth2/token';

const KROGER_CLIENT_ID = process.env.NEXT_PUBLIC_KROGER_CLIENT_ID || '';
const KROGER_CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET || '';

// Simple in-memory cache for OAuth tokens (expires after 30 minutes)
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

/**
 * Get a valid OAuth 2.0 access token from Kroger's API using client credentials.
 * Tokens are cached and reused until expiration.
 */
export async function getKrogerAccessToken(): Promise<string | null> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  if (!KROGER_CLIENT_ID || !KROGER_CLIENT_SECRET) {
    console.warn('Kroger API credentials not configured. Skipping Kroger product lookup.');
    return null;
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'product.compact',
    });

    const response = await fetch(KROGER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${KROGER_CLIENT_ID}:${KROGER_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      console.error('Failed to get Kroger OAuth token:', response.statusText);
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    // Cache the token with a 5-minute buffer before expiry
    cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000,
    };

    return data.access_token;
  } catch (error) {
    console.error('Error fetching Kroger OAuth token:', error);
    return null;
  }
}

export interface KrogerProduct {
  productId: string;
  upc: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  description?: string;
  caloriesPerServing?: number;
}

interface KrogerApiImage {
  perspective?: string;
  featured?: boolean;
  sizes?: Array<{
    size?: string;
    url?: string;
  }>;
}

function getKrogerImageUrl(images?: KrogerApiImage[]) {
  if (!images || images.length === 0) return undefined;

  const preferredImage =
    images.find((image) => image.featured && image.perspective === 'front') ??
    images.find((image) => image.perspective === 'front') ??
    images[0];

  return (
    preferredImage.sizes?.find((size) => size.size === 'xlarge')?.url ??
    preferredImage.sizes?.find((size) => size.size === 'large')?.url ??
    preferredImage.sizes?.[0]?.url
  );
}

/**
 * Search for a product by UPC/barcode on Kroger's API.
 * Returns product details including image URL if available.
 */
export async function searchKrogerProductByUPC(upc: string): Promise<KrogerProduct | null> {
  const token = await getKrogerAccessToken();
  if (!token) return null;

  try {
    // Kroger's product search endpoint
    const response = await fetch(
      `${KROGER_BASE_URL}/products?filter.upc=${upc}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      },
    );

    if (!response.ok) {
      console.error('Kroger product search failed:', response.statusText);
      return null;
    }

    const data = (await response.json()) as {
      data?: Array<{
        productId: string;
        upc: string;
        name: string;
        brand?: string;
        description?: string;
        images?: KrogerApiImage[];
        nutrition?: {
          servingSize?: {
            amount: number;
            unit: string;
          };
          calories?: number;
        };
      }>;
    };

    if (!data.data || data.data.length === 0) {
      return null;
    }

    const product = data.data[0];
    const imageUrl = getKrogerImageUrl(product.images);

    return {
      productId: product.productId,
      upc: product.upc,
      name: product.name,
      brand: product.brand,
      imageUrl,
      description: product.description,
      caloriesPerServing: product.nutrition?.calories,
    };
  } catch (error) {
    console.error('Error searching Kroger products by UPC:', error);
    return null;
  }
}

/**
 * Search for a product by name on Kroger's API.
 * Useful for finding products when UPC is not available.
 */
export async function searchKrogerProductByName(
  productName: string,
  limit = 1,
): Promise<KrogerProduct[]> {
  const token = await getKrogerAccessToken();
  if (!token) return [];

  try {
    const response = await fetch(
      `${KROGER_BASE_URL}/products?filter.term=${encodeURIComponent(productName)}&filter.limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      },
    );

    if (!response.ok) {
      console.error('Kroger product search by name failed:', response.statusText);
      return [];
    }

    const data = (await response.json()) as {
      data?: Array<{
        productId: string;
        upc: string;
        name: string;
        brand?: string;
        description?: string;
        images?: KrogerApiImage[];
        nutrition?: {
          servingSize?: {
            amount: number;
            unit: string;
          };
          calories?: number;
        };
      }>;
    };

    if (!data.data) {
      return [];
    }

    return data.data.map((product) => ({
      productId: product.productId,
      upc: product.upc,
      name: product.name,
      brand: product.brand,
      imageUrl: getKrogerImageUrl(product.images),
      description: product.description,
      caloriesPerServing: product.nutrition?.calories,
    }));
  } catch (error) {
    console.error('Error searching Kroger products by name:', error);
    return [];
  }
}

/**
 * Get the primary image URL for a Kroger product by product ID.
 * Useful if you already have the product ID and just need the image.
 */
export async function getKrogerProductImage(productId: string): Promise<string | null> {
  const token = await getKrogerAccessToken();
  if (!token) return null;

  try {
    const response = await fetch(`${KROGER_BASE_URL}/products/${productId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      data?: {
        images?: KrogerApiImage[];
      };
    };

    const imageUrl = getKrogerImageUrl(data.data?.images);
    return imageUrl || null;
  } catch (error) {
    console.error('Error fetching Kroger product image:', error);
    return null;
  }
}

/**
 * Enrich catalog foods with Kroger product images based on their barcodes.
 * Updates food objects in-place with Kroger images where available, preserving fallbacks.
 * Non-blocking: runs in background and silently fails over to existing images.
 */
export async function enrichFoodsWithKrogerImages(
  foods: Array<{ barcode?: string; imageUrl?: string }>,
): Promise<void> {
  if (!KROGER_CLIENT_ID || !KROGER_CLIENT_SECRET) {
    return; // Skip silently if credentials not configured
  }

  for (const food of foods) {
    if (!food.barcode) continue;

    try {
      const krogerProduct = await searchKrogerProductByUPC(food.barcode);
      if (krogerProduct?.imageUrl) {
        food.imageUrl = krogerProduct.imageUrl;
      }
    } catch {
      // Silently skip on error, keep existing fallback image
    }
  }
}
