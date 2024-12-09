import { QueryResult, sql } from '@vercel/postgres';

import { invoices, Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';
import { bigint, date, string } from 'zod';
import { Console, log } from 'console';
import { equal } from 'assert';
import { UUID } from 'crypto';

export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

     console.log('Fetching revenue data...');
     await new Promise((resolve) => setTimeout(resolve, 3000));

    //const data = await sql<Revenue>`SELECT * FROM revenue`;

    const data = await prisma.revenue.findMany(
      
    );

     console.log('Data fetch completed after 3 seconds.');

    //return data.rows;
    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    /*
    const data = await sql<LatestInvoiceRaw>`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`;
      */

      const data = await  prisma.invoices.findMany(
      {            
          include :
          {
            customer : {
              select : {
                name : true,
                image_url : true,
                email : true

              }
            }
          },
          orderBy :{
            date : 'desc'
        },
        take: 5
          /*
          relationLoadStrategy: 'join',
          select : {
            name : true,
            image_url : true,
            email : true
          },       
          include : {            
            invoices : {
              orderBy : {
                date : 'desc'
              },
              select : {
                id : true,
                amount : true
              }
            }
          }, 

          */
                 
        }
      )

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    //const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    const invoiceCountPromise = prisma.invoices.aggregate(
      {
        _count :{
          id : true
        }
      }
    );
    //const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;

    const customerCountPromise = prisma.customers.aggregate(
      {
        _count :{
          id : true
        }
      }
    );
    
    /*
    const invoiceStatusPromise = sql`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`;

    */    
    class InvoiceStatus {
      paid? : number | undefined | null = null;
      pending : number | undefined | null = null;

      constructor (){
        this.paid = null;
        this.pending =null;

      }   
    }    


    /*

    const invoiceStatusPromise = await prisma.$queryRaw`
         SELECT 
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices;
       `;

       */

      const invoiceStatusPromise = await prisma.invoices.groupBy(
        {
          by : ['status'],
          _sum:{
            amount : true
          }
        }
       )

    

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    
    
    //const numberOfInvoices = Number(data[0].rows[0].count ?? '0');
    const numberOfInvoices = Number(data[0]._count.id ?? '0');
    //const numberOfCustomers = Number(data[1].rows[0].count ?? '0');
    const numberOfCustomers = Number(data[1]._count.id ?? '0');
    //const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? '0');
    const sumOfPaidInvoices = data[2].find(c=>c.status == 'paid');
    const sumOfPendingInvoices = data[2].find(c=>c.status == 'pending');
    
    const totalPaidInvoices = formatCurrency(sumOfPaidInvoices?._sum.amount ?? 0);
    const totalPendingInvoices = formatCurrency(sumOfPendingInvoices?._sum.amount ?? 0);

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {

    
    //const invoices = await sql<InvoicesTable>`
    const invoices = await prisma.$queryRaw<InvoicesTable>`   
     
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    /*

    const invoices = await prisma.invoices.findMany(
      {  
           
        include : {
          customer : {
            select : {
              name: true,
              email : true,
              image_url : true
            }

          }          
        },
        where : {
          OR:[
            {
              customer : {
                name : {
                  contains : query
                }
              }
            },

            {
              customer : {
                email : {
                  contains : query
                }
              }
            },
            {            
              status : {
                contains : query
              }
              
            }
          ],
        
        },
        take : ITEMS_PER_PAGE

      
      }
    )
*/



    

    //return invoices.rows;
    return invoices;
    
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}


export async function fetchInvoicesPages(query: string) {
  try {
    //const count = await sql`SELECT COUNT(*)
    const count = await prisma.$queryRaw<[]>`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE ${`%${query}%`} OR
      customers.email ILIKE ${`%${query}%`} OR
      invoices.amount::text ILIKE ${`%${query}%`} OR
      invoices.date::text ILIKE ${`%${query}%`} OR
      invoices.status ILIKE ${`%${query}%`}
  `;

    const totalPages = Math.ceil(Number(count[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    //const data = await sql<InvoiceForm>`
    
    const data = await prisma.$queryRaw<invoices[]>`

      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id}::uuid;
    `;

    const invoice = data.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    console.log(invoice); // Invoice is an empty array []
    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    /*
    const data = await sql<CustomerField>`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `;

    */

    const data = await prisma.customers.findMany(
      {        
        orderBy : [
          {
            name : 'asc'
          }
        ],
        select : {
          id : true,
          name : true
        }
      }
    );

    //const customers = data.rows;
    //return customers;
    return data;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    //const data = await sql<CustomersTableType>`
    const data = await prisma.$queryRaw<CustomersTableType[]>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(Number(customer.total_pending)),
      total_paid: formatCurrency(Number(customer.total_paid)),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
