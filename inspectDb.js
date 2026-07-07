import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase environment variables are missing!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("--- SHOPS ---");
  const { data: shops, error: shopsErr } = await supabase.from('shops').select('id, name, pinned, status');
  if (shopsErr) {
    console.error("Error fetching shops:", shopsErr);
  } else {
    console.log(shops);
  }

  console.log("\n--- PRODUCTS FOR s_1782752614737 ---");
  const { data: products, error: productsErr } = await supabase.from('products').select('*').eq('shopId', 's_1782752614737');
  if (productsErr) {
    console.error("Error fetching products:", productsErr);
  } else {
    products.forEach(p => {
      console.log({
        id: p.id,
        name: p.name,
        shopId: p.shopId,
        category: p.category,
        deleted: p.deleted,
        price: p.price,
        imageLength: p.image ? p.image.length : 0,
        imageType: p.image ? typeof p.image : 'none'
      });
    });
  }
}

main();
