const COMPARATIVA_DATA = [
  {
    id: 'jabon',
    tab: 'Jabón en barra',
    titulo: 'Jabón en barra',
    img: 'assets/images/comparativa-jabon.jpg.jpg',
    alt: 'Limpieza con jabón en barra',
    items: [
      { etiqueta: 'Tiempo', valor: '20-30 minutos' },
      { etiqueta: 'Proceso', valor: 'Tallar a mano' },
      { etiqueta: 'Riesgo', valor: 'Manchas amarillas, desgaste del material' },
      { etiqueta: 'Resultado', valor: 'Variable' }
    ]
  },
  {
    id: 'lavadora',
    tab: 'Lavadora',
    titulo: 'Lavadora',
    img: 'assets/images/comparativa-lavadora.jpg.jpg',
    alt: 'Limpieza en lavadora',
    items: [
      { etiqueta: 'Tiempo', valor: '45-60 minutos + secado' },
      { etiqueta: 'Proceso', valor: 'Ciclo completo, después esperar que sequen' },
      { etiqueta: 'Riesgo', valor: 'Puede despegar la suela, deformar el tenis' },
      { etiqueta: 'Resultado', valor: 'Variable' }
    ]
  },
  {
    id: 'espuma',
    tab: 'Espuma genérica',
    titulo: 'Espuma genérica ($10.000)',
    img: 'assets/images/comparativa-espuma.jpg.jpg',
    alt: 'Limpieza con espuma genérica',
    items: [
      { etiqueta: 'Tiempo', valor: '10 minutos' },
      { etiqueta: 'Proceso', valor: 'Aplicar y tallar igual' },
      { etiqueta: 'Riesgo', valor: 'No siempre quita manchas profundas' },
      { etiqueta: 'Incluye', valor: 'Solo la espuma, sin cepillo ni antiolor' }
    ]
  }
];

const COMPARATIVA_INTACTO = {
  titulo: 'INTACTO',
  img: 'assets/images/hero-kit.jpg.jpeg',
  alt: 'Kit INTACTO',
  items: [
    { etiqueta: 'Tiempo', valor: '2 minutos' },
    { etiqueta: 'Proceso', valor: 'Espuma + cepillo, listo' },
    { etiqueta: 'Riesgo', valor: 'Ninguno reportado' },
    { etiqueta: 'Incluye', valor: 'Espuma, spray antiolores, cepillo, toalla de microfibra' }
  ]
};
