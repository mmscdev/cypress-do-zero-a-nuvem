const CryptoJS = require('crypto-js');
describe('Teste de Job no WildFly', () => {  
  const wildflyCreds = {
    username: 'xxxxx', // Substitua pelo seu nome de usuário
    password: 'xxxxxxx'  // Sua senha de login
  };
it('Diagnóstico: Testa apenas a autenticação via cy.request', () => {
  cy.request({
    method: 'GET',
    url: 'https://pje-d1.trt15.jus.br/console/index.html',
    auth: {
       username: 'xxxxx', // Substitua pelo seu nome de usuário
        password: 'xxxxxxx'    // Substitua pela sua senha
    }
  }).then((response) => {
    cy.log('response', response);
    // Se a autenticação funcionar, o status deve ser 200 (OK)
    expect(response.status).to.eq(200);        
    const method = 'POST';
    const url = 'https://pje-d1.trt15.jus.br/management';
    const uri = '/management'; // Apenas o caminho da URL

    // --- ETAPA 1: Fazer uma requisição inicial para obter o desafio do servidor ---
    cy.request({
      method: method,
      url: url,
      failOnStatusCode: false // Permite que a gente capture o erro 401
    }).then((initialResponse) => {
      // Esperamos um 401 para confirmar que é um desafio Digest
      expect(initialResponse.status).to.eq(401);
      //expect(initialResponse.headers['www-authenticate']).to.eq(401);
      //cy.log('Cabeçalho de desafio recebido:', initialResponse);

      const wwwAuthenticateHeader = initialResponse.headers['www-authenticate'];
      cy.log('wwwAuthenticateHeader:', wwwAuthenticateHeader);

      // --- ETAPA 2: Extrair os detalhes do desafio do cabeçalho ---
      const realm = wwwAuthenticateHeader.match(/realm="([^"]+)"/)[1];
      const nonce = wwwAuthenticateHeader.match(/nonce="([^"]+)"/)[1];
      const qop = "auth";
      const opaque = "00000000000000000000000000000000";
      
      // --- ETAPA 3: Construir a resposta do Digest ---
      const cnonce = CryptoJS.lib.WordArray.random(16).toString(); // Client nonce
      const nc = '00000001'; // Nonce count

      const ha1 = CryptoJS.MD5(`${wildflyCreds.username}:${realm}:${wildflyCreds.password}`).toString();
      const ha2 = CryptoJS.MD5(`${method}:${uri}`).toString();
      const responseHash = CryptoJS.MD5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).toString();

      // Monta o cabeçalho de autorização final
      const authorizationHeader = `Digest username="${wildflyCreds.username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${responseHash}", opaque="${opaque}"`;
      
      cy.log('Cabeçalho de autorização construído:', authorizationHeader);

      // --- ETAPA 4: Fazer a requisição final com o cabeçalho correto ---
      cy.request({
        method: method,
        url: url,
        headers: {
          'Authorization': authorizationHeader
        },
        body: {
          "operation": "start-job",
          "address": [
            { "deployment": "exe-backend-jobs.war" },
            { "subsystem": "batch-jberet" }
          ],
          "job-xml-name": "ProcessoPilotoAtualizacaoJob.xml",
          "json.pretty": 1
        },
        failOnStatusCode: true
      }).then((finalResponse) => {
        expect(finalResponse.status).to.equal(200);
        expect(finalResponse.body.outcome).to.equal('success');
        cy.log('Job acionado com sucesso!');
        cy.log(`ID da execução: ${finalResponse.body.result}`);
      });
    });
     });
      });
});