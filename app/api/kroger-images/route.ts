import { NextResponse } from 'next/server';

import { searchKrogerProductByName, searchKrogerProductByUPC } from '../../../src/lib/krogerApi';

interface KrogerImageRequestFood {
  id?: string;
  barcode?: string;
  name?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { foods?: KrogerImageRequestFood[] };
    const foods = body.foods ?? [];
    const images: Record<string, string> = {};

    for (const food of foods) {
      if (!food.id) continue;

      const product = food.barcode ? await searchKrogerProductByUPC(food.barcode) : null;
      if (product?.imageUrl) {
        images[food.id] = product.imageUrl;
        continue;
      }

      if (food.name) {
        const [matchingProduct] = await searchKrogerProductByName(food.name, 1);
        if (matchingProduct?.imageUrl) {
          images[food.id] = matchingProduct.imageUrl;
        }
      }
    }

    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: {} });
  }
}