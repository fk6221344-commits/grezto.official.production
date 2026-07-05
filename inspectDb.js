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

  console.log("\n--- PRODUCTS ---");
  const { data: products, error: productsErr } = await supabase.from('products').select('id, name, shopId').limit(10);
  if (productsErr) {
    console.error("Error fetching products:", productsErr);
  } else {
    console.log(products);
  }
}

main();
