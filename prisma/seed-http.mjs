/**
 * Seed script using Supabase Data API (HTTP) instead of Prisma.
 * Run with: node prisma/seed-http.mjs
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Read .env
const env = readFileSync('.env', 'utf-8');
const getEnv = (key) => env.match(new RegExp(`${key}="([^"]+)"`))?.[1];

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
    console.log('🌱 Seeding database via Supabase Data API...');
    console.log('📡 URL:', url);

    // ─── Use Cases ───────────────────────────────────────
    const useCases = [
        { id: 'seed-uc-1', industry: 'Finanças', title: 'Automação de Processamento de Faturas', summary: 'Utilização de OCR e IA para automatizar a extração de dados de faturas, reduzindo erros manuais em 85%.', challenge: 'Processamento manual de centenas de faturas por mês.', solution: 'Pipeline de OCR + classificação IA.', results: 'Redução de 85% em erros, 60% menos tempo.', isGlobal: true },
        { id: 'seed-uc-2', industry: 'Saúde', title: 'Triagem Inteligente de Documentos Clínicos', summary: 'Sistema de IA para classificar e encaminhar documentos clínicos automaticamente.', challenge: 'Volume elevado de documentos clínicos requer triagem manual.', solution: 'Modelo de NLP para classificação automática.', results: 'Tempo de triagem reduzido em 40%.', isGlobal: true },
        { id: 'seed-uc-3', industry: 'Retalho', title: 'Previsão de Procura com IA', summary: 'Modelos preditivos para otimizar inventário e reduzir desperdício em 30%.', challenge: 'Gestão de stock ineficiente.', solution: 'Modelo de previsão baseado em séries temporais.', results: 'Redução de 30% em desperdício.', isGlobal: true },
        { id: 'seed-uc-4', industry: 'Finanças', title: 'Deteção de Anomalias em Transações', summary: 'Sistema de IA para identificar padrões atípicos em transações financeiras.', challenge: 'Revisão manual de transações suspeitas.', solution: 'Modelo de deteção de anomalias.', results: 'Deteção 3x mais rápida.', isGlobal: true },
        { id: 'seed-uc-5', industry: 'Saúde', title: 'Assistente Virtual para Agendamentos', summary: 'Chatbot com IA para gestão de marcações, reduzindo chamadas em 45%.', challenge: 'Sobrecarga da equipa de receção.', solution: 'Assistente virtual multicanal.', results: 'Redução de 45% em chamadas.', isGlobal: true },
        { id: 'seed-uc-6', industry: 'Retalho', title: 'Personalização de Ofertas', summary: 'Motor de recomendações que aumentou a conversão em 25%.', challenge: 'Ofertas genéricas com baixa conversão.', solution: 'Motor de recomendação comportamental.', results: 'Aumento de 25% na conversão.', isGlobal: true },
    ];

    const { error: ucError } = await db
        .from('UseCase')
        .upsert(useCases, { onConflict: 'id' });

    if (ucError) {
        console.error('❌ Use Cases error:', ucError.message);
    } else {
        console.log('✅ Use Cases:', useCases.length, 'seeded');
    }

    // ─── Governance Templates ────────────────────────────
    const templates = [
        { id: 'seed-tmpl-1', name: 'Política de Privacidade (RGPD)', category: 'RGPD', content: '# Política de Privacidade\n\n## 1. Âmbito\nA presente política aplica-se ao tratamento de dados pessoais realizados pela empresa.\n\n## 2. Responsável pelo Tratamento\n[Nome e contactos do responsável]\n\n## 3. Dados Recolhidos\n- Dados de identificação pessoal\n- Dados de contacto\n- Dados de utilização da plataforma\n\n## 4. Finalidades do Tratamento\n- Prestação de serviços contratados\n- Comunicações comerciais (com consentimento)\n- Cumprimento de obrigações legais\n\n## 5. Base Legal\nConsentimento, execução de contrato, interesse legítimo, obrigação legal.\n\n## 6. Direitos dos Titulares\n- Acesso aos dados pessoais\n- Retificação de dados incorretos\n- Apagamento dos dados\n- Portabilidade dos dados\n- Oposição ao tratamento\n\n## 7. Período de Conservação\nOs dados são conservados pelo período estritamente necessário.\n\n## 8. Contacto do DPO\n[Email do Encarregado de Proteção de Dados]', isGlobal: true },
        { id: 'seed-tmpl-2', name: 'Registo de Atividades de Tratamento', category: 'RGPD', content: '# Registo de Atividades de Tratamento\n\n## Informações do Responsável\n- **Nome da Organização:** [Nome]\n- **Contacto:** [Email/Telefone]\n- **DPO:** [Nome do Encarregado]\n\n## Atividades de Tratamento\n\n### Atividade 1: [Nome]\n- **Finalidade:** [Descrever a finalidade do tratamento]\n- **Categorias de dados:** [Listar tipos de dados tratados]\n- **Categorias de titulares:** [Quem são os titulares]\n- **Destinatários:** [Quem recebe os dados]\n- **Prazo de conservação:** [Período definido]\n- **Medidas de segurança:** [Técnicas e organizativas]', isGlobal: true },
        { id: 'seed-tmpl-3', name: 'Avaliação de Impacto (DPIA)', category: 'RGPD', content: '# Avaliação de Impacto na Proteção de Dados (DPIA)\n\n## 1. Descrição Sistemática do Tratamento\n[Descrever em detalhe o tratamento proposto, incluindo natureza, âmbito, contexto e finalidades]\n\n## 2. Avaliação da Necessidade e Proporcionalidade\n[Justificar porque o tratamento é necessário e proporcional às finalidades]\n\n## 3. Avaliação de Riscos para os Direitos e Liberdades\n- **Risco 1:** [Descrição] — Probabilidade: [Alta/Média/Baixa] — Impacto: [Alto/Médio/Baixo]\n- **Risco 2:** [Descrição] — Probabilidade: [Alta/Média/Baixa] — Impacto: [Alto/Médio/Baixo]\n\n## 4. Medidas de Mitigação\n[Descrever medidas previstas para mitigar cada risco identificado]\n\n## 5. Consulta à Autoridade de Controlo\n[Indicar se é necessária consulta prévia à CNPD]', isGlobal: true },
        { id: 'seed-tmpl-4', name: 'Política de Segurança da Informação', category: 'Segurança', content: '# Política de Segurança da Informação\n\n## 1. Âmbito e Objetivo\nEsta política aplica-se a todos os sistemas de informação, colaboradores e parceiros.\n\n## 2. Classificação da Informação\n- **Pública:** Informação de acesso livre\n- **Interna:** Uso interno da organização\n- **Confidencial:** Acesso restrito a autorizados\n- **Estritamente Confidencial:** Acesso limitado a indivíduos específicos\n\n## 3. Controlo de Acessos\n- Princípio do menor privilégio\n- Autenticação multi-fator obrigatória\n- Revisão periódica de acessos (trimestral)\n- Revogação imediata em caso de cessação\n\n## 4. Gestão de Incidentes\n[Procedimentos de deteção, reporte e resposta a incidentes de segurança]', isGlobal: true },
        { id: 'seed-tmpl-5', name: 'Plano de Resposta a Incidentes', category: 'Segurança', content: '# Plano de Resposta a Incidentes de Segurança\n\n## 1. Definição de Incidente\nQualquer evento que comprometa a confidencialidade, integridade ou disponibilidade da informação.\n\n## 2. Equipa de Resposta\n- **Coordenador:** [Nome e contacto]\n- **Técnico de Segurança:** [Nome e contacto]\n- **Jurídico:** [Nome e contacto]\n- **Comunicação:** [Nome e contacto]\n\n## 3. Procedimentos\n### 3.1 Deteção e Classificação\n[Como identificar e classificar a gravidade]\n### 3.2 Contenção\n[Medidas imediatas para limitar o impacto]\n### 3.3 Erradicação\n[Remoção da causa do incidente]\n### 3.4 Recuperação\n[Restauro dos serviços e sistemas afetados]\n\n## 4. Notificação\n- **CNPD:** até 72 horas após conhecimento\n- **Titulares dos dados:** sem demora injustificada, se risco elevado', isGlobal: true },
        { id: 'seed-tmpl-6', name: 'Política de Utilização de IA', category: 'IA', content: '# Política de Utilização de Inteligência Artificial\n\n## 1. Princípios Fundamentais\n- **Transparência:** Documentar todos os sistemas de IA em uso\n- **Equidade:** Garantir não-discriminação nos resultados\n- **Responsabilidade:** Definir responsáveis por cada sistema\n- **Privacidade por Design:** Integrar proteção de dados desde a conceção\n\n## 2. Governança de IA\n- Comité de aprovação para novos projetos de IA\n- Avaliação de impacto obrigatória antes de implementação\n- Revisão periódica de modelos em produção\n\n## 3. Dados de Treino\n- Verificação de consentimento para utilização\n- Auditoria de viés nos dados de treino\n- Documentação da proveniência dos dados\n\n## 4. Monitorização Contínua\n- Métricas de performance definidas\n- Alertas automáticos para desvios\n- Relatórios trimestrais de auditoria', isGlobal: true },
        { id: 'seed-tmpl-7', name: 'Governança de Dados', category: 'Dados', content: '# Framework de Governança de Dados\n\n## 1. Estrutura Organizacional\n- **Data Owner:** Responsável pelo domínio de dados\n- **Data Steward:** Garante qualidade e conformidade\n- **Data Custodian:** Gere infraestrutura técnica\n\n## 2. Qualidade de Dados\n- **Completude:** Todos os campos obrigatórios preenchidos\n- **Consistência:** Dados uniformes entre sistemas\n- **Precisão:** Dados corretos e atualizados\n- **Atualidade:** Dados dentro do prazo de validade\n\n## 3. Ciclo de Vida dos Dados\nRecolha → Validação → Armazenamento → Utilização → Arquivo → Destruição\n\n## 4. Políticas de Acesso\n- Definição clara de quem pode aceder a que dados\n- Logs de auditoria para todos os acessos\n- Revisão periódica de permissões', isGlobal: true },
        { id: 'seed-tmpl-8', name: 'Consentimento para Tratamento de Dados', category: 'RGPD', content: '# Formulário de Consentimento para Tratamento de Dados Pessoais\n\n## Informação ao Titular dos Dados\n\nEu, _________________________, declaro que fui informado/a e autorizo a [Nome da Empresa] a tratar os meus dados pessoais para as seguintes finalidades:\n\n☐ Prestação dos serviços contratados\n☐ Envio de comunicações comerciais e newsletters\n☐ Perfilagem para personalização de serviços\n☐ Partilha com parceiros comerciais autorizados\n\n## Direitos do Titular\nPosso retirar o meu consentimento a qualquer momento, sem que isso afete a licitude do tratamento anterior, contactando: [email de contacto]\n\n**Data:** ___/___/______\n**Assinatura:** _________________________', isGlobal: true },
    ].map(t => ({ ...t, updatedAt: new Date().toISOString() }));

    const { error: tmplError } = await db
        .from('GovernanceTemplate')
        .upsert(templates, { onConflict: 'id' });

    if (tmplError) {
        console.error('❌ Templates error:', tmplError.message);
    } else {
        console.log('✅ Governance Templates:', templates.length, 'seeded');
    }

    console.log('✅ Seed complete!');
}

main().catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
});
