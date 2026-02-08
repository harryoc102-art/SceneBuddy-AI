import { sql } from '@vercel/postgres';

export { sql };

export async function query<T = any>(
  queryText: string,
  params: any[] = []
): Promise<T[]> {
  try {
    if (params.length === 0) {
      const result = await sql.unsafe(queryText);
      return result.rows as T[];
    }
    
    let processedQuery = queryText;
    
    for (let i = params.length - 1; i >= 0; i--) {
      const placeholder = `$${i + 1}`;
      const value = params[i];
      
      let escapedValue: string;
      if (value === null || value === undefined) {
        escapedValue = 'NULL';
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        escapedValue = String(value);
      } else if (typeof value === 'string') {
        const escaped = value.replace(/'/g, "''");
        escapedValue = `'${escaped}'`;
      } else if (Array.isArray(value)) {
        escapedValue = `ARRAY[${value.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')}]`;
      } else {
        escapedValue = `'${String(value).replace(/'/g, "''")}'`;
      }
      
      processedQuery = processedQuery.replace(placeholder, escapedValue);
    }
    
    const result = await sql.unsafe(processedQuery);
    return result.rows as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function queryOne<T = any>(
  queryText: string,
  params: any[] = []
): Promise<T | null> {
  const rows = await query<T>(queryText, params);
  return rows[0] || null;
}
