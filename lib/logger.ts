export function logAPI(req: any, message: string = "") {
    const { method, url, query } = req;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${method} ${url} ${message}`);
    if (Object.keys(query).length > 0) {
        console.log(`  Query: ${JSON.stringify(query)}`);
    }
}
