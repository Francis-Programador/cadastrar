import { describe, expect, it } from 'vitest';
import { buildServerErrorMessage } from '../membros/assets/auth.js';

describe('member auth error messages', () => {
  it('explains when the App Script endpoint is redirecting instead of returning JSON', () => {
    const message = buildServerErrorMessage({
      status: 302,
      redirected: true,
      rawText: '',
      route: '/api/membros',
    });

    expect(message).toContain('/exec');
    expect(message).toContain('publicado');
    expect(message).toContain('/api/membros');
  });

  it('explains when the endpoint returns HTML instead of JSON', () => {
    const message = buildServerErrorMessage({
      status: 404,
      redirected: false,
      rawText: '<html><body>Not found</body></html>',
      route: '/api/membros',
    });

    expect(message).toContain('HTML');
    expect(message).toContain('/api/membros');
  });

  it('explains when the endpoint returns an empty body', () => {
    const message = buildServerErrorMessage({
      status: 200,
      rawText: '',
      route: '/api/membros',
    });

    expect(message).toContain('sem conteúdo JSON');
    expect(message).toContain('Apps Script de membros');
  });

  it('explains when Live Server cannot validate the upstream TLS certificate', () => {
    const message = buildServerErrorMessage({
      status: 500,
      rawText: '<pre>Error: unable to verify the first certificate</pre>',
      route: '/api/membros',
    });

    expect(message).toContain('certificado HTTPS');
    expect(message).toContain('npm run dev');
    expect(message).toContain('http://localhost:8080/membros/');
    expect(message).toContain('Go Live');
  });

  it('explains when the configured Apps Script URL resolves to a Google Drive 404', () => {
    const message = buildServerErrorMessage({
      status: 404,
      rawText: '<title>Página não encontrada</title><p>Google Drive</p>',
      route: '/api/membros',
    });

    expect(message).toContain('URL /exec');
    expect(message).toContain('implantação publicada');
  });
});
