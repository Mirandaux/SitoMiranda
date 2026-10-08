import { defineMiddleware } from 'astro:middleware';
import { guardFormRequest } from './lib/form-guard.js';

const forms = new Set(['/api/contact', '/api/contact-fit-sprint', '/api/download-matrix']);
export const onRequest = defineMiddleware((context, next) => {
  if (context.request.method === 'POST' && forms.has(context.url.pathname)) {
    let address;
    try { address = context.clientAddress; } catch { /* Some static adapters do not expose an address. */ }
    const rejected = guardFormRequest(context.request, address);
    if (rejected) return rejected;
  }
  return next();
});
