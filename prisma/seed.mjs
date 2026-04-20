import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

// Read .env manually
const envContent = readFileSync('.env', 'utf-8');
const dbUrl = envContent.match(/DATABASE_URL="([^"]+)"/)?.[1];
if (!dbUrl) throw new Error('DATABASE_URL not found in .env');

const prisma = new PrismaClient({ datasourceUrl: dbUrl });

async function main() {
    console.log('🌱 Seeding database...');
    console.log('📡 Connecting to:', dbUrl.replace(/:[^:@]+@/, ':***@'));

    const company = await prisma.company.upsert({
        where: { id: 'default-company' },
        update: {},
        create: { id: 'default-company', name: 'Disruptio Demo', plan: 'starter' },
    });
    console.log('✅ Company:', company.name);

    const useCases = [
        { id: 'seed-uc-1', industry: 'Finanças', title: 'Automação de Processamento de Faturas', summary: 'Utilização de OCR e IA para automatizar a extração de dados de faturas, reduzindo erros manuais em 85%.', challenge: 'Processamento manual de centenas de faturas por mês.', solution: 'Pipeline de OCR + classificação IA.', results: 'Redução de 85% em erros, 60% menos tempo.', isGlobal: true },
        { id: 'seed-uc-2', industry: 'Saúde', title: 'Triagem Inteligente de Documentos Clínicos', summary: 'Sistema de IA para classificar e encaminhar documentos clínicos automaticamente.', challenge: 'Volume elevado de documentos clínicos requer triagem manual.', solution: 'Modelo de NLP para classificação automática.', results: 'Tempo de triagem reduzido em 40%.', isGlobal: true },
        { id: 'seed-uc-3', industry: 'Retalho', title: 'Previsão de Procura com IA', summary: 'Modelos preditivos para otimizar inventário e reduzir desperdício em 30%.', challenge: 'Gestão de stock ineficiente.', solution: 'Modelo de previsão baseado em séries temporais.', results: 'Redução de 30% em desperdício.', isGlobal: true },
        { id: 'seed-uc-4', industry: 'Finanças', title: 'Deteção de Anomalias em Transações', summary: 'Sistema de IA para identificar padrões atípicos em transações financeiras.', challenge: 'Revisão manual de transações suspeitas.', solution: 'Modelo de deteção de anomalias.', results: 'Deteção 3x mais rápida.', isGlobal: true },
        { id: 'seed-uc-5', industry: 'Saúde', title: 'Assistente Virtual para Agendamentos', summary: 'Chatbot com IA para gestão de marcações, reduzindo chamadas em 45%.', challenge: 'Sobrecarga da equipa de receção.', solution: 'Assistente virtual multicanal.', results: 'Redução de 45% em chamadas.', isGlobal: true },
        { id: 'seed-uc-6', industry: 'Retalho', title: 'Personalização de Ofertas', summary: 'Motor de recomendações que aumentou a conversão em 25%.', challenge: 'Ofertas genéricas com baixa conversão.', solution: 'Motor de recomendação comportamental.', results: 'Aumento de 25% na conversão.', isGlobal: true },
    ];

    for (const uc of useCases) {
        await prisma.useCase.upsert({ where: { id: uc.id }, update: uc, create: uc });
    }
    console.log('✅ Use Cases:', useCases.length, 'seeded');

    const templates = [
        { id: 'seed-tmpl-1', name: 'Política de Privacidade (RGPD)', category: 'RGPD', content: '# Política de Privacidade\n\n## 1. Âmbito\nA presente política aplica-se ao tratamento de dados pessoais.\n\n## 2. Dados Recolhidos\n- Dados de identificação\n- Dados de contacto\n\n## 3. Direitos dos Titulares\n- Acesso, retificação, apagamento\n- Portabilidade, oposição', isGlobal: true },
        { id: 'seed-tmpl-2', name: 'Registo de Atividades de Tratamento', category: 'RGPD', content: '# Registo de Atividades\n\nInformações do Responsável\n- Nome: [Empresa]\n- DPO: [Nome]', isGlobal: true },
        { id: 'seed-tmpl-3', name: 'Avaliação de Impacto (DPIA)', category: 'RGPD', content: '# DPIA\n\n1. Descrição do Tratamento\n2. Riscos\n3. Mitigação', isGlobal: true },
        { id: 'seed-tmpl-4', name: 'Política de Segurança da Informação', category: 'Segurança', content: '# Política de Segurança\n\nClassificação: Pública / Interna / Confidencial\nControlo de Acessos: Menor privilégio, MFA obrigatória', isGlobal: true },
        { id: 'seed-tmpl-5', name: 'Plano de Resposta a Incidentes', category: 'Segurança', content: '# Resposta a Incidentes\n\n1. Deteção 2. Contenção 3. Erradicação 4. Recuperação\nNotificação CNPD: até 72h', isGlobal: true },
        { id: 'seed-tmpl-6', name: 'Política de Utilização de IA', category: 'IA', content: '# Política de IA\n\nPrincípios: Transparência, Equidade, Responsabilidade, Privacidade por design', isGlobal: true },
        { id: 'seed-tmpl-7', name: 'Governança de Dados', category: 'Dados', content: '# Governança de Dados\n\nEstrutura: Data Owner / Data Steward / Data Custodian', isGlobal: true },
        { id: 'seed-tmpl-8', name: 'Consentimento para Tratamento', category: 'RGPD', content: '# Consentimento\n\nEu, [Nome], autorizo o tratamento dos meus dados pessoais.', isGlobal: true },
    ];

    for (const t of templates) {
        await prisma.governanceTemplate.upsert({ where: { id: t.id }, update: t, create: t });
    }
    console.log('✅ Governance Templates:', templates.length, 'seeded');

    console.log('✅ Seed complete!');
}

main()
    .catch((e) => { console.error('Seed error:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
