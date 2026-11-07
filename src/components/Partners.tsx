/**
 * Aba "Parceiros": os apoiadores da rádio, um banner embaixo do outro.
 * Para trocar ou incluir parceiros, edite a lista PARTNERS e coloque as imagens
 * em public/assets/parceiros/ (JPG + WebP com o mesmo nome).
 */

export interface Partner {
  /** nome do arquivo, sem extensão, em public/assets/parceiros/ */
  file: string;
  /** descrição para leitores de tela */
  alt: string;
}

export const PARTNERS: Partner[] = [
  { file: 'padaria-maranata', alt: 'Padaria Maranata: bolos, doces e salgados. Telefone 43 3154-4472. JD Santo Amaro, Cambé, Paraná.' },
  { file: 'odonto-magalhaes', alt: 'OdontoMagalhães Clínica Dentária. Parque Ouro Branco: Av. Guilherme de Almeida, 381, fone 43 3066-7109. Jardim Franciscato: Rua Erenilda Maria de Jesus, 381, fone 43 3039-2471.' },
  { file: 'deposito-nova-dantzig', alt: 'Depósito Nova Dantzig: material para construção em geral. Tel. 43 3154-3030, WhatsApp 99902-1970. Av. Bernardino de Campos, 15, Jd. São Paulo, Cambé.' },
  { file: 'carvao-imperial', alt: 'Carvão Imperial: ideal para churrasco, fogão a lenha e lareira. WhatsApp 43 99690-4333.' },
];

export function Partners() {
  return (
    <section className="partners" aria-labelledby="partners-title">
      <header className="section-head">
        <div>
          <p className="eyebrow">Apoio cultural</p>
          <h1 id="partners-title" className="section-title">Parceiros</h1>
        </div>
      </header>

      <ul className="partners__list">
        {PARTNERS.map((p, i) => (
          <li key={p.file} className="partners__item" style={{ ['--n' as string]: i }}>
            <picture>
              <source srcSet={`assets/parceiros/${p.file}.webp`} type="image/webp" />
              <img
                src={`assets/parceiros/${p.file}.jpg`}
                alt={p.alt}
                width={1600}
                height={639}
                loading={i < 2 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </picture>
          </li>
        ))}
      </ul>
    </section>
  );
}
