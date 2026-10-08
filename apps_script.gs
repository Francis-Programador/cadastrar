// Nome da aba na planilha do Google Sheets
const SHEET_NAME = "Membros_Premium";

/**
 * Função para tratar requisições POST (Cadastro de novos membros)
 */
function doPost(e) {
  try {
    const sheet = getOrCreateSheet();
    const data = JSON.parse(e.postData.contents);

    // Processa apenas a ação de cadastro
    if (data.action === "register") {
      const idMembro = "MBR-" + new Date().getTime();
      const dataRegistro = new Date().toLocaleString("pt-BR", { timeZone: "Africa/Luanda" });

      // Linha organizada conforme a estrutura do banco de dados
      const newRow = [
        idMembro,
        dataRegistro,
        data.nomeCompleto || "",
        data.usuario || "",
        data.email || "",
        data.whatsapp || "",
        data.idade || "",
        data.pais || "",
        data.urlComprovante || "",
        "Pendente",
        "",
        data.aceiteTermos ? "Sim" : "Não"
      ];

      // Verifica se o usuário ou e-mail já existe
      const existingData = sheet.getDataRange().getValues();
      for (let i = 1; i < existingData.length; i++) {
        if (existingData[i][3] === data.usuario) {
          return createResponse({ success: false, message: "Este nome de usuário já está em uso." });
        }
        if (existingData[i][4] === data.email) {
          return createResponse({ success: false, message: "Este e-mail já está cadastrado." });
        }
      }

      sheet.appendRow(newRow);
      return createResponse({ success: true, message: "Cadastro realizado com sucesso! Aguarde a liberação." });
    }

    return createResponse({ success: false, message: "Ação não reconhecida." });

  } catch (error) {
    return createResponse({ success: false, message: "Erro no servidor: " + error.toString() });
  }
}

/**
 * Função para tratar requisições GET (Login e verificação de status)
 */
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const action = e.parameter.action;
    const usuarioOrEmail = e.parameter.usuario;

    if (action === "login") {
      const data = sheet.getDataRange().getValues();

      // Percorre a planilha procurando o usuário/e-mail
      for (let i = 1; i < data.length; i++) {
        const userRow = data[i];
        const username = userRow[3];
        const email = userRow[4];
        const status = userRow[9];
        const nomeCompleto = userRow[2];
        const dataVencimento = userRow[10];

        if (username === usuarioOrEmail || email === usuarioOrEmail) {
          if (status === "Ativo") {
            return createResponse({
              success: true,
              status: "Ativo",
              user: {
                nome: nomeCompleto,
                usuario: username,
                vencimento: dataVencimento
              }
            });
          } else if (status === "Pendente") {
            return createResponse({ success: false, status: "Pendente", message: "Seu cadastro ainda está em análise." });
          } else if (status === "Expirado") {
            return createResponse({ success: false, status: "Expirado", message: "Sua assinatura expirou. Faça a renovação." });
          } else {
            return createResponse({ success: false, message: "Acesso bloqueado ou inativo." });
          }
        }
      }

      return createResponse({ success: false, message: "Usuário não encontrado." });
    }

    return createResponse({ success: false, message: "Parâmetros inválidos." });

  } catch (error) {
    return createResponse({ success: false, message: "Erro no processamento: " + error.toString() });
  }
}

/**
 * Utilitário: Obtém a aba existente ou cria com o cabeçalho correto
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Cria os cabeçalhos na primeira linha
    sheet.appendRow([
      "ID_Membro",
      "Data_Registro",
      "Nome_Completo",
      "Nome_Usuario",
      "Email",
      "WhatsApp",
      "Idade",
      "Pais_Residencia",
      "Url_Comprovante",
      "Status_Conta",
      "Data_Vencimento",
      "Aceite_Termos"
    ]);
  }
  return sheet;
}

/**
 * Utilitário: Formata a resposta no formato JSON para o front-end
 */
function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
