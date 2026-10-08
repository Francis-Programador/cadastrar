import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const appsScriptSource = readFileSync(path.resolve(process.cwd(), 'apps_script.gs'), 'utf8');

function createAppsScriptContext({
  members,
  firebaseUser = {
    localId: 'firebase-uid-1',
    email: 'ana@example.com',
    emailVerified: true,
    validSince: '',
  },
  tokenStatus = 200,
} = {}) {
  const rows = [
    [
      'ID_Membro', 'Data_Registro', 'Nome_Completo', 'Nome_Usuario', 'Email',
      'WhatsApp', 'Idade', 'Pais_Residencia', 'Url_Comprovante', 'Status_Conta',
      'Data_Vencimento', 'Aceite_Termos', 'Firebase_UID',
    ],
    ...(members || []),
  ];

  const sheet = {
    getLastColumn: () => Math.max(...rows.map((row) => row.length)),
    getDataRange: () => ({ getValues: () => rows.map((row) => [...row]) }),
    getRange: (row, column) => ({
      getDisplayValues: () => [rows[row - 1].slice(column - 1)],
      setValue: (value) => {
        while (rows[row - 1].length < column) rows[row - 1].push('');
        rows[row - 1][column - 1] = value;
      },
    }),
    appendRow: (row) => rows.push(row),
  };

  const context = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => sheet,
        insertSheet: () => sheet,
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'firebase-api-key' }),
    },
    UrlFetchApp: {
      fetch: (_url, options) => ({
        getResponseCode: () => tokenStatus,
        getContentText: () => JSON.stringify(
          tokenStatus === 200
            ? { users: [firebaseUser] }
            : { error: { message: 'INVALID_ID_TOKEN' } }
        ),
        payload: options.payload,
      }),
    },
    LockService: {
      getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }),
    },
    Utilities: {
      base64DecodeWebSafe: (value) => Buffer.from(value, 'base64url'),
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
      formatDate: () => '2026-10-08',
      getUuid: () => '12345678-1234-1234-1234-123456789abc',
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({
        text,
        setMimeType() { return this; },
      }),
    },
  };

  vm.runInNewContext(appsScriptSource, context);
  return { context, rows };
}

function makeToken() {
  const payload = Buffer.from(JSON.stringify({ auth_time: 1_800_000_000 }))
    .toString('base64url');
  return `header.${payload}.signature`;
}

function post(context, payload) {
  const result = context.doPost({
    postData: { contents: JSON.stringify(payload) },
  });
  return JSON.parse(result.text);
}

describe('Apps Script member authentication', () => {
  it('returns only the record attached to the verified Firebase UID', () => {
    const { context } = createAppsScriptContext({
      members: [
        [
          'MBR-1', '01/10/2026', 'Ana Trader', 'ana', 'ana@example.com',
          '+244900000000', 28, 'Angola', 'https://res.cloudinary.com/demo/proof.jpg',
          'Ativo', '31/12/2099', 'Sim', 'firebase-uid-1',
        ],
        [
          'MBR-2', '01/10/2026', 'Outra Pessoa', 'outra', 'outra@example.com',
          '+244911111111', 30, 'Angola', 'https://res.cloudinary.com/demo/other.jpg',
          'Ativo', '31/12/2099', 'Sim', 'firebase-uid-2',
        ],
      ],
    });

    const result = post(context, {
      action: 'memberSession',
      firebaseIdToken: makeToken(),
      ID_Membro: 'MBR-2',
    });

    expect(result.success).toBe(true);
    expect(result.member.ID_Membro).toBe('MBR-1');
    expect(result.member.Email).toBe('ana@example.com');
    expect(JSON.stringify(result)).not.toContain('Outra Pessoa');
  });

  it('does not grant access to a pending member', () => {
    const { context } = createAppsScriptContext({
      members: [[
        'MBR-1', '01/10/2026', 'Ana Trader', 'ana', 'ana@example.com',
        '+244900000000', 28, 'Angola', 'https://res.cloudinary.com/demo/proof.jpg',
        'Pendente', '', 'Sim', 'firebase-uid-1',
      ]],
    });

    const result = post(context, {
      action: 'memberSession',
      firebaseIdToken: makeToken(),
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('PENDENTE');
    expect(result.member).toBeUndefined();
  });

  it('does not associate a verified email when the legacy row is linked to another UID', () => {
    const { context } = createAppsScriptContext({
      members: [[
        'MBR-1', '01/10/2026', 'Ana Trader', 'ana', 'ana@example.com',
        '+244900000000', 28, 'Angola', 'https://res.cloudinary.com/demo/proof.jpg',
        'Ativo', '31/12/2099', 'Sim', 'different-firebase-uid',
      ]],
    });

    const result = post(context, {
      action: 'memberSession',
      firebaseIdToken: makeToken(),
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('CADASTRO_NAO_ASSOCIADO');
  });

  it('rejects an ID token the Firebase lookup does not validate', () => {
    const { context } = createAppsScriptContext({ tokenStatus: 400 });

    const result = post(context, {
      action: 'memberSession',
      firebaseIdToken: makeToken(),
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Sessão inválida. Entre novamente.');
  });
});
