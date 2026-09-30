/**
 * Guia de SEO para Páginas
 *
 * Como adicionar SEO customizado em cada página usando o hook useSEO
 */

import { useSEO } from '@/hooks/use-seo';

/**
 * EXEMPLO 1: Página de Aulas
 */
export function AulasPageExample() {
  useSEO({
    title: 'Aulas de Trading - 3SER Trader Sem Ré',
    description:
      'Aulas completas de trading do zero até avançado. Aprenda fundamentos, análise técnica, gestão de risco e estratégias com profissionais experientes.',
    keywords: 'aulas trading, análise técnica, gestão de risco, educação',
    ogUrl: 'https://3ser-trader.com/aulas',
  });

  return <div>Página de Aulas</div>;
}

/**
 * EXEMPLO 2: Página de Planilhas
 */
export function PlanilhasPageExample() {
  useSEO({
    title: 'Planilhas e Ferramentas de Trading - 3SER',
    description:
      'Baixe planilhas, calculadoras e ferramentas gratuitas para controlar suas operações. Gerencie risco, lucro/prejuízo e evolua sua performance.',
    keywords: 'planilhas trading, calculadora, ferramentas, análise',
    ogUrl: 'https://3ser-trader.com/planilhas',
  });

  return <div>Página de Planilhas</div>;
}

/**
 * EXEMPLO 3: Página de Blog/Artigo Individual
 */
export function BlogArticleExample() {
  // Simulando dados dinâmicos de um artigo
  const article = {
    title: '5 Erros Comuns que Todo Trader Iniciante Comete',
    description:
      'Descubra os 5 erros mais comuns entre traders iniciantes e como evitá-los. Saiba como não perder dinheiro em suas primeiras operações.',
    published: '2026-04-09',
    author: '3SER Trader Hub',
  };

  useSEO({
    title: `${article.title} - 3SER Trader`,
    description: article.description,
    keywords: 'erros trader, iniciante, trading tips, educação',
    ogUrl: `https://3ser-trader.com/blog/${article.published}`,
  });

  return <article>{article.title}</article>;
}

/**
 * EXEMPLO 4: Página de Contato
 */
export function ContatoPageExample() {
  useSEO({
    title: 'Entre em Contato - 3SER Trader Sem Ré',
    description:
      'Dúvidas sobre trading? Entre em contato conosco. Queremos ouvir você e ajudar no seu caminho para se tornar um trader consistente.',
    keywords: 'contato, suporte, dúvidas trading',
    ogUrl: 'https://3ser-trader.com/contato',
  });

  return <div>Página de Contato</div>;
}

/**
 * EXEMPLO 5: Página de Resultados (Dinâmica com dados de API)
 */
export function ResultadosPageExample() {
  useSEO({
    title: 'Resultados Reais de Trading - 3SER',
    description:
      'Veja os resultados reais e a performance do nosso trading. Transparência total sobre lucros, perdas e evolução mês a mês.',
    keywords: 'resultados trading, performance, lucro, transparência',
    ogUrl: 'https://3ser-trader.com/resultados',
    ogImage: 'https://3ser-trader.com/resultados-og.jpg', // Imagem customizada
  });

  return <div>Página de Resultados</div>;
}

/**
 * GUIA DE USO
 *
 * 1. Importe o hook no topo da sua página:
 *    import { useSEO } from '@/hooks/use-seo';
 *
 * 2. Chame o hook no corpo do componente:
 *    useSEO({
 *      title: 'Seu Título',
 *      description: 'Sua descrição',
 *      // ... outras opções
 *    });
 *
 * 3. As meta tags serão atualizadas automaticamente
 *
 * BOAS PRÁTICAS:
 * ✅ Título: 50-60 caracteres, inclua a palavra-chave principal
 * ✅ Description: 150-160 caracteres, descreva o conteúdo
 * ✅ Keywords: 3-5 palavras-chave separadas por vírgula
 * ✅ OG URL: URL completa e exata da página
 * ✅ OG Image: Imagem 1200x630px em alta qualidade
 *
 * ❌ Evite:
 * ❌ Títulos muito longos (truncados nos resultados)
 * ❌ Descrições keyword-stuffing (spam)
 * ❌ Keywords não relacionadas ao conteúdo
 */
