import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
    console.log('🌱 Seeding database...');

    // ─── Create default company ──────────────────────────
    const company = await prisma.company.upsert({
        where: { id: 'default-company' },
        update: {},
        create: {
            id: 'default-company',
            name: 'Disruptio Demo',
            plan: 'starter',
        },
    });
    console.log('✅ Company:', company.name);

    // ─── Use Cases (FR-10, FR-11) ────────────────────────
    const useCases = [
        {
            id: 'seed-uc-automacao-facturas',
            industry: 'Finanças',
            title: 'Automação de Processamento de Faturas',
            summary: 'Utilização de OCR e IA para automatizar a extração de dados de faturas, reduzindo erros manuais em 85% e tempo de processamento em 60%.',
            challenge: 'Processamento manual de centenas de faturas por mês com taxas de erro elevadas.',
            solution: 'Pipeline de OCR + classificação IA para extração automática de dados-chave.',
            results: 'Redução de 85% em erros, 60% menos tempo de processamento.',
            isGlobal: true,
        },
        {
            id: 'seed-uc-triagem-clinica',
            industry: 'Saúde',
            title: 'Triagem Inteligente de Documentos Clínicos',
            summary: 'Sistema de IA para classificar e encaminhar documentos clínicos automaticamente, melhorando o tempo de resposta em 40%.',
            challenge: 'Volume elevado de documentos clínicos requer triagem manual demorada.',
            solution: 'Modelo de NLP para classificação automática por tipo e urgência.',
            results: 'Tempo de triagem reduzido em 40%, melhor priorização de casos urgentes.',
            isGlobal: true,
        },
        {
            id: 'seed-uc-previsao-procura',
            industry: 'Retalho',
            title: 'Previsão de Procura com IA',
            summary: 'Modelos preditivos para otimizar inventário e reduzir desperdício em 30%, utilizando dados históricos de vendas e tendências.',
            challenge: 'Gestão de stock ineficiente com excesso e ruptura frequentes.',
            solution: 'Modelo de previsão baseado em séries temporais e variáveis externas.',
            results: 'Redução de 30% em desperdício e 15% de melhoria na disponibilidade.',
            isGlobal: true,
        },
        {
            id: 'seed-uc-anomalias-transacoes',
            industry: 'Finanças',
            title: 'Deteção de Anomalias em Transações',
            summary: 'Sistema de IA para identificar padrões atípicos em transações financeiras, detetando potenciais fraudes 3x mais rápido.',
            challenge: 'Revisão manual de transações suspeitas é lenta e falha casos subtis.',
            solution: 'Modelo de deteção de anomalias com aprendizagem contínua.',
            results: 'Deteção 3x mais rápida, redução de 50% em falsos positivos.',
            isGlobal: true,
        },
        {
            id: 'seed-uc-assistente-agendamentos',
            industry: 'Saúde',
            title: 'Assistente Virtual para Agendamentos',
            summary: 'Chatbot com IA para gestão de marcações, reduzindo chamadas telefónicas em 45% e melhorando a experiência do paciente.',
            challenge: 'Sobrecarga da equipa de receção com chamadas de agendamento.',
            solution: 'Assistente virtual multicanal com integração ao sistema de marcações.',
            results: 'Redução de 45% em chamadas, satisfação do paciente +20%.',
            isGlobal: true,
        },
        {
            id: 'seed-uc-personalizacao-ofertas',
            industry: 'Retalho',
            title: 'Personalização de Ofertas',
            summary: 'Motor de recomendações personalizado que aumentou a conversão em 25% através de sugestões baseadas no comportamento do cliente.',
            challenge: 'Ofertas genéricas com baixa taxa de conversão.',
            solution: 'Motor de recomendação baseado em comportamento de compra e navegação.',
            results: 'Aumento de 25% na conversão e 15% no valor médio de encomenda.',
            isGlobal: true,
        },
    ];

    for (const uc of useCases) {
        await prisma.useCase.upsert({
            where: { id: uc.id },
            update: { ...uc },
            create: { ...uc },
        });
    }
    console.log(`✅ Use Cases: ${useCases.length} seeded`);

    // ─── Governance Templates (FR-14, FR-15) ─────────────
    const templates = [
        { id: 'seed-tmpl-politica-privacidade', name: 'Política de Privacidade (RGPD)', category: 'RGPD', content: '# Política de Privacidade\n\n## 1. Âmbito\nA presente política aplica-se ao tratamento de dados pessoais.\n\n## 2. Responsável pelo Tratamento\n[Nome e contactos]\n\n## 3. Dados Recolhidos\n- Dados de identificação\n- Dados de contacto\n- Dados de utilização\n\n## 4. Finalidades\n- Prestação de serviços\n- Comunicações comerciais\n- Cumprimento legal\n\n## 5. Direitos dos Titulares\n- Acesso, retificação, apagamento\n- Portabilidade, oposição\n\n## 6. Contacto do DPO\n[Email do DPO]', isGlobal: true },
        { id: 'seed-tmpl-registo-actividades', name: 'Registo de Atividades de Tratamento', category: 'RGPD', content: '# Registo de Atividades de Tratamento\n\n## Informações do Responsável\n- Nome: [Empresa]\n- DPO: [Nome]\n\n## Atividades\n### Atividade 1\n- Finalidade: [Descrever]\n- Categorias de dados: [Listar]\n- Prazo de conservação: [Período]\n- Medidas de segurança: [Descrever]', isGlobal: true },
        { id: 'seed-tmpl-dpia', name: 'Avaliação de Impacto (DPIA)', category: 'RGPD', content: '# DPIA\n\n## 1. Descrição do Tratamento\n[Detalhe]\n\n## 2. Necessidade e Proporcionalidade\n[Justificação]\n\n## 3. Riscos\n[Identificar riscos]\n\n## 4. Medidas de Mitigação\n[Descrever]', isGlobal: true },
        { id: 'seed-tmpl-seguranca-info', name: 'Política de Segurança da Informação', category: 'Segurança', content: '# Política de Segurança\n\n## 1. Classificação da Informação\n- Pública / Interna / Confidencial\n\n## 2. Controlo de Acessos\n- Menor privilégio\n- MFA obrigatória\n\n## 3. Gestão de Incidentes\n[Procedimentos]', isGlobal: true },
        { id: 'seed-tmpl-resposta-incidentes', name: 'Plano de Resposta a Incidentes', category: 'Segurança', content: '# Plano de Resposta a Incidentes\n\n## Procedimentos\n1. Deteção\n2. Contenção\n3. Erradicação\n4. Recuperação\n\n## Notificação\n- CNPD: até 72h\n- Titulares: sem demora', isGlobal: true },
        { id: 'seed-tmpl-politica-ia', name: 'Política de Utilização de IA', category: 'IA', content: '# Política de IA\n\n## Princípios\n- Transparência\n- Equidade\n- Responsabilidade\n- Privacidade por design\n\n## Governança\n[Estrutura de aprovação]\n\n## Monitorização\n[Como monitorizar modelos]', isGlobal: true },
        { id: 'seed-tmpl-governanca-dados', name: 'Governança de Dados', category: 'Dados', content: '# Governança de Dados\n\n## Estrutura\n- Data Owner\n- Data Steward\n- Data Custodian\n\n## Qualidade\n- Completude\n- Consistência\n- Precisão\n\n## Ciclo de Vida\nRecolha → Armazenamento → Uso → Arquivo → Destruição', isGlobal: true },
        { id: 'seed-tmpl-consentimento', name: 'Consentimento para Tratamento', category: 'RGPD', content: '# Formulário de Consentimento\n\nEu, [Nome], autorizo o tratamento dos meus dados para:\n\n☐ Prestação de serviços\n☐ Comunicações comerciais\n☐ Perfilagem\n\nPode retirar o consentimento a qualquer momento.\n\nData: ___/___/___\nAssinatura: _____', isGlobal: true },
    ];

    for (const tmpl of templates) {
        await prisma.governanceTemplate.upsert({
            where: { id: tmpl.id },
            update: tmpl,
            create: tmpl,
        });
    }
    console.log(`✅ Governance Templates: ${templates.length} seeded`);

    console.log('✅ Seed complete!');
}

main()
    .catch((e) => {
        console.error('Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
