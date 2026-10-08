const SHEET_NAME = "Membros_Premium";
const FIREBASE_UID_HEADER = "Firebase_UID";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");

    if (data.action === "register") {
      return createResponse(registerMember(data));
    }

    if (data.action === "memberSession") {
      return createResponse(getMemberSession(data.firebaseIdToken));
    }

    return createResponse({ success: false, message: "Ação não reconhecida." });
  } catch (error) {
    console.error("Member API request failed: " + error.message);
    return createResponse({
      success: false,
      message: error.publicMessage || "Não foi possível processar a solicitação."
    });
  }
}

function doGet() {
  return createResponse({
    success: false,
    message: "Autenticação necessária. Entre com e-mail e senha."
  });
}

function registerMember(data) {
  const firebaseUser = verifyFirebaseIdToken(data.firebaseIdToken);
  const email = normalizeEmail(data.email);
  if (!email || email !== normalizeEmail(firebaseUser.email)) {
    return { success: false, message: "O e-mail da conta não corresponde ao cadastro." };
  }

  const name = cleanText(data.nomeCompleto, 120);
  const username = cleanText(data.usuario, 40).toLowerCase();
  const whatsapp = cleanPhone(data.whatsapp);
  const country = cleanText(data.pais, 80);
  const age = Number(data.idade);
  const proofUrl = String(data.urlComprovante || "").trim();

  if (!name || !/^[a-z0-9._-]{3,40}$/.test(username) ||
      !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !whatsapp || !country || !Number.isInteger(age) || age < 18 || age > 120 ||
      data.aceiteTermos !== true || !isCloudinaryUrl(proofUrl)) {
    return { success: false, message: "Confira os campos obrigatórios e aceite os termos para continuar." };
  }

  const sheet = getOrCreateSheet();
  const uidColumn = ensureFirebaseUidColumn(sheet);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const rows = sheet.getDataRange().getValues();
    const emailMatches = [];
    let uidMatch = null;

    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      const rowEmail = normalizeEmail(row[4]);
      const rowUsername = String(row[3] || "").trim().toLowerCase();
      const rowUid = String(row[uidColumn - 1] || "").trim();

      if (rowUid === firebaseUser.localId) uidMatch = index;
      if (rowEmail === email) emailMatches.push(index);
    }

    if (uidMatch !== null) {
      return { success: true, message: "Sua conta já está associada ao cadastro." };
    }

    if (emailMatches.length > 1) {
      return { success: false, message: "Não foi possível localizar um cadastro único para este e-mail. Fale com o suporte." };
    }

    if (emailMatches.length === 1) {
      const emailMatch = emailMatches[0];
      const existingUid = String(rows[emailMatch][uidColumn - 1] || "").trim();
      if (existingUid) {
        return { success: false, message: "Não foi possível associar esta conta ao cadastro existente. Fale com o suporte." };
      }

      if (!firebaseUser.emailVerified) {
        return { success: true, message: "Confirme seu e-mail e entre; sua conta será associada ao cadastro existente." };
      }

      sheet.getRange(emailMatch + 1, uidColumn).setValue(firebaseUser.localId);
      return { success: true, message: "Sua conta foi associada ao cadastro existente." };
    }

    const duplicateUsername = rows.slice(1).some(
      row => String(row[3] || "").trim().toLowerCase() === username
    );
    if (duplicateUsername) {
      return { success: false, message: "Este nome de usuário já está em uso." };
    }

    const now = new Date();
    const row = [
      "MBR-" + Utilities.getUuid().replace(/-/g, "").slice(0, 12).toUpperCase(),
      Utilities.formatDate(now, "Africa/Luanda", "dd/MM/yyyy HH:mm:ss"),
      name,
      username,
      email,
      whatsapp,
      age,
      country,
      proofUrl,
      "Pendente",
      "",
      "Sim"
    ];
    row[uidColumn - 1] = firebaseUser.localId;
    sheet.appendRow(row);

    return {
      success: true,
      message: "Cadastro recebido. Aguarde a validação da mensalidade."
    };
  } finally {
    lock.releaseLock();
  }
}

function getMemberSession(idToken) {
  const firebaseUser = verifyFirebaseIdToken(idToken);
  if (!firebaseUser.emailVerified) {
    return { success: false, status: "EMAIL_NAO_VERIFICADO", message: "Confirme seu e-mail para continuar." };
  }

  const sheet = getOrCreateSheet();
  const uidColumn = ensureFirebaseUidColumn(sheet);
  const rows = sheet.getDataRange().getValues();
  let memberIndex = rows.findIndex(
    (row, index) => index > 0 && String(row[uidColumn - 1] || "").trim() === firebaseUser.localId
  );

  if (memberIndex === -1) {
    const matches = [];
    rows.forEach((row, index) => {
      if (index > 0 && normalizeEmail(row[4]) === normalizeEmail(firebaseUser.email)) {
        matches.push(index);
      }
    });

    if (matches.length === 1) {
      memberIndex = matches[0];
      const existingUid = String(rows[memberIndex][uidColumn - 1] || "").trim();
      if (existingUid && existingUid !== firebaseUser.localId) {
        return { success: false, status: "CADASTRO_NAO_ASSOCIADO", message: "Não foi possível validar o cadastro. Fale com o suporte." };
      }
      sheet.getRange(memberIndex + 1, uidColumn).setValue(firebaseUser.localId);
      rows[memberIndex][uidColumn - 1] = firebaseUser.localId;
    }
  }

  if (memberIndex === -1) {
    return { success: false, status: "CADASTRO_NAO_ENCONTRADO", message: "Cadastro não encontrado. Envie sua solicitação de acesso." };
  }

  const row = rows[memberIndex];
  let status = String(row[9] || "").trim().toUpperCase();
  const expiry = parseSheetDate(row[10]);

  if (status === "ATIVO" && (!expiry || expiry.getTime() < startOfToday().getTime())) {
    status = "EXPIRADO";
    sheet.getRange(memberIndex + 1, 10).setValue(status);
  }

  if (status !== "ATIVO") {
    const messages = {
      PENDENTE: "Seu cadastro está em análise. O acesso será liberado após a confirmação da mensalidade.",
      EXPIRADO: "Sua assinatura expirou. Fale com o administrador para renová-la."
    };
    return {
      success: false,
      status: status || "SUSPENSO",
      message: messages[status] || "Sua conta não está ativa. Fale com o suporte."
    };
  }

  return {
    success: true,
    member: {
      ID_Membro: String(row[0] || ""),
      Nome_Completo: String(row[2] || ""),
      Nome_Usuario: String(row[3] || ""),
      Email: normalizeEmail(row[4]),
      Status_Conta: "Ativo",
      Plano: "Mensal",
      Data_Registro: String(row[1] || ""),
      Data_Vencimento: row[10] instanceof Date
        ? Utilities.formatDate(row[10], "Africa/Luanda", "yyyy-MM-dd")
        : String(row[10] || "")
    }
  };
}

function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") {
    throw publicError("Sessão ausente ou inválida.", "Firebase ID token is required.");
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty("FIREBASE_WEB_API_KEY");
  if (!apiKey) {
    throw publicError("O servidor de autenticação ainda não está configurado.", "Firebase API key is not configured.");
  }

  let response;
  try {
    response = UrlFetchApp.fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey),
      {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ idToken: idToken }),
        muteHttpExceptions: true
      }
    );
  } catch (error) {
    const details = String(error && error.message || error);
    if (/permission|authoriz|scope/i.test(details)) {
      throw publicError(
        "O Apps Script precisa de autorização para validar contas Firebase. O administrador deve executar authorizeFirebaseRequests no editor e aceitar as permissões.",
        "Firebase lookup permission failed: " + details
      );
    }
    throw publicError(
      "O servidor não conseguiu validar a conta no Firebase. Tente novamente mais tarde.",
      "Firebase lookup request failed: " + details
    );
  }

  const result = JSON.parse(response.getContentText() || "{}");
  const user = result.users && result.users[0];

  if (response.getResponseCode() !== 200 || !user || user.disabled) {
    throw publicError("Sessão inválida. Entre novamente.", "Firebase token validation failed.");
  }

  const payload = decodeFirebaseTokenPayload(idToken);
  const authTime = Number(payload.auth_time || 0);
  const validSince = Number(user.validSince || 0);
  if (!authTime || (validSince && authTime < validSince)) {
    throw publicError("Sessão inválida. Entre novamente.", "Firebase token has been revoked.");
  }

  return {
    localId: String(user.localId || ""),
    email: String(user.email || ""),
    emailVerified: user.emailVerified === true
  };
}

function authorizeFirebaseRequests() {
  const apiKey = PropertiesService.getScriptProperties().getProperty("FIREBASE_WEB_API_KEY");
  if (!apiKey) {
    throw new Error("Configure FIREBASE_WEB_API_KEY nas propriedades do script antes de continuar.");
  }

  const response = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey),
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken: "authorization-diagnostic-invalid-token" }),
      muteHttpExceptions: true
    }
  );
  const result = JSON.parse(response.getContentText() || "{}");
  if (response.getResponseCode() !== 400 ||
      !result.error ||
      result.error.message !== "INVALID_ID_TOKEN") {
    throw new Error("Não foi possível confirmar a autorização e a conexão com o Firebase.");
  }

  return "Autorização externa confirmada. Nenhum cadastro ou dado da planilha foi alterado.";
}

function decodeFirebaseTokenPayload(idToken) {
  try {
    const encodedPayload = idToken.split(".")[1];
    const bytes = Utilities.base64DecodeWebSafe(encodedPayload);
    return JSON.parse(Utilities.newBlob(bytes).getDataAsString());
  } catch (error) {
    throw publicError("Sessão inválida. Entre novamente.", "Firebase token payload is invalid.");
  }
}

function getOrCreateSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "ID_Membro", "Data_Registro", "Nome_Completo", "Nome_Usuario", "Email",
      "WhatsApp", "Idade", "Pais_Residencia", "Url_Comprovante", "Status_Conta",
      "Data_Vencimento", "Aceite_Termos"
    ]);
  }

  return sheet;
}

function ensureFirebaseUidColumn(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const existingColumn = headers.indexOf(FIREBASE_UID_HEADER);

  if (existingColumn >= 0) return existingColumn + 1;

  const uidColumn = Math.max(lastColumn + 1, 13);
  sheet.getRange(1, uidColumn).setValue(FIREBASE_UID_HEADER);
  return uidColumn;
}

function cleanText(value, maxLength) {
  const text = String(value || "").trim();
  if (/^[=+\-@]/.test(text)) return "";
  return text.slice(0, maxLength);
}

function cleanPhone(value) {
  const phone = String(value || "").trim();
  if (!/^\+?[\d\s().-]{6,39}$/.test(phone)) return "";
  return /^[+-]/.test(phone) ? "'" + phone : phone;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isCloudinaryUrl(value) {
  return /^https:\/\/res\.cloudinary\.com\/[^/]+\/.+/i.test(value);
}

function parseSheetDate(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function publicError(publicMessage, logMessage) {
  const error = new Error(logMessage);
  error.publicMessage = publicMessage;
  return error;
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
