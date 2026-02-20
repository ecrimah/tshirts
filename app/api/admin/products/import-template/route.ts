import { NextResponse } from 'next/server';

const SAMPLE_CSV = `name,description,category,price,compare_at_price,quantity,moq,status,featured,seo_title,seo_description,keywords,low_stock_threshold,preorder_shipping,images,variant_color,variant_color_hex,variant_size,variant_price,variant_stock
"Wireless Bluetooth Earbuds","Premium wireless Bluetooth 5.3 earbuds with ANC and 30hr battery.","Electronics",89.99,120.00,150,1,"Active",true,"Wireless Bluetooth Earbuds","Shop premium wireless earbuds.","earbuds,bluetooth,wireless",5,,"earbuds-white.jpg;earbuds-case.jpg",,,,,,
"Classic Cotton T-Shirt","100% premium combed cotton t-shirt.","Fashion",35.00,50.00,,2,"Active",true,"Classic Cotton T-Shirt","Premium cotton t-shirt.","basics,cotton",5,,"tshirt-black.jpg;tshirt-white.jpg","Black","#000000","S",35.00,80
"Classic Cotton T-Shirt","100% premium combed cotton t-shirt.","Fashion",35.00,50.00,,2,"Active",true,"Classic Cotton T-Shirt","Premium cotton t-shirt.","basics,cotton",5,,"tshirt-black.jpg;tshirt-white.jpg","Black","#000000","M",35.00,100
"Classic Cotton T-Shirt","100% premium combed cotton t-shirt.","Fashion",35.00,50.00,,2,"Active",true,"Classic Cotton T-Shirt","Premium cotton t-shirt.","basics,cotton",5,,"tshirt-black.jpg;tshirt-white.jpg","White","#FFFFFF","M",38.00,90
`;

export async function GET() {
  return new NextResponse(SAMPLE_CSV, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="products-import-template.csv"',
    },
  });
}
