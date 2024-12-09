import { db } from "@vercel/postgres";
import { PrismaClient } from '@prisma/client'
import { invoices } from "../lib/placeholder-data";

const prisma = new PrismaClient()

const client = await db.connect();

async function listInvoices() {
  const data = await prisma.customers.findMany({    
    include: {
      invoices: true
    }
    
  })

  /*
	const data = await client.sql`
    SELECT invoices.amount, customers.name
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE invoices.amount = 666;
  `;
 */
	//return data.rows;
  return data.entries;
}

export async function GET() {
  
  try {
  	return Response.json(await listInvoices());
  } catch (error) {
  	return Response.json({ error }, { status: 500 });
  }
}
