// Departamentos y municipios de Colombia para los selects de Departamento/
// Ciudad del checkout. No es la lista exhaustiva de los ~1.100 municipios
// del país — cubre capitales y municipios grandes/conocidos de cada
// departamento, y cada departamento incluye "Otro municipio" al final para
// que el cliente escriba el suyo si no aparece en la lista.
window.COLOMBIA_DEPARTMENTS = [
  { name: 'Amazonas', cities: ['Leticia', 'Puerto Nariño'] },
  { name: 'Antioquia', cities: ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Rionegro', 'Sabaneta', 'Apartadó', 'Turbo', 'Caucasia', 'La Estrella', 'Copacabana', 'Girardota', 'Marinilla', 'El Carmen de Viboral'] },
  { name: 'Arauca', cities: ['Arauca', 'Arauquita', 'Saravena', 'Tame'] },
  { name: 'Atlántico', cities: ['Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Puerto Colombia', 'Baranoa'] },
  { name: 'Bogotá D.C.', cities: ['Bogotá'] },
  { name: 'Bolívar', cities: ['Cartagena', 'Magangué', 'Turbaco', 'Arjona', 'El Carmen de Bolívar'] },
  { name: 'Boyacá', cities: ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá', 'Paipa', 'Villa de Leyva'] },
  { name: 'Caldas', cities: ['Manizales', 'La Dorada', 'Chinchiná', 'Villamaría', 'Riosucio'] },
  { name: 'Caquetá', cities: ['Florencia', 'San Vicente del Caguán'] },
  { name: 'Casanare', cities: ['Yopal', 'Aguazul', 'Villanueva'] },
  { name: 'Cauca', cities: ['Popayán', 'Santander de Quilichao', 'Puerto Tejada'] },
  { name: 'Cesar', cities: ['Valledupar', 'Aguachica', 'Codazzi'] },
  { name: 'Chocó', cities: ['Quibdó', 'Istmina'] },
  { name: 'Córdoba', cities: ['Montería', 'Cereté', 'Sahagún', 'Lorica'] },
  { name: 'Cundinamarca', cities: ['Soacha', 'Chía', 'Zipaquirá', 'Facatativá', 'Fusagasugá', 'Girardot', 'Mosquera', 'Madrid', 'Funza', 'Cajicá'] },
  { name: 'Guainía', cities: ['Inírida'] },
  { name: 'Guaviare', cities: ['San José del Guaviare'] },
  { name: 'Huila', cities: ['Neiva', 'Pitalito', 'Garzón'] },
  { name: 'La Guajira', cities: ['Riohacha', 'Maicao', 'Uribia'] },
  { name: 'Magdalena', cities: ['Santa Marta', 'Ciénaga', 'Fundación'] },
  { name: 'Meta', cities: ['Villavicencio', 'Acacías', 'Granada'] },
  { name: 'Nariño', cities: ['Pasto', 'Ipiales', 'Tumaco'] },
  { name: 'Norte de Santander', cities: ['Cúcuta', 'Ocaña', 'Pamplona', 'Villa del Rosario'] },
  { name: 'Putumayo', cities: ['Mocoa', 'Puerto Asís'] },
  { name: 'Quindío', cities: ['Armenia', 'Calarcá', 'La Tebaida', 'Montenegro'] },
  { name: 'Risaralda', cities: ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal'] },
  { name: 'San Andrés y Providencia', cities: ['San Andrés', 'Providencia'] },
  { name: 'Santander', cities: ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja', 'San Gil', 'Socorro', 'Málaga'] },
  { name: 'Sucre', cities: ['Sincelejo', 'Corozal'] },
  { name: 'Tolima', cities: ['Ibagué', 'Espinal', 'Melgar', 'Honda'] },
  { name: 'Valle del Cauca', cities: ['Cali', 'Palmira', 'Buenaventura', 'Tuluá', 'Cartago', 'Buga', 'Yumbo', 'Jamundí'] },
  { name: 'Vaupés', cities: ['Mitú'] },
  { name: 'Vichada', cities: ['Puerto Carreño'] }
];

window.COLOMBIA_OTHER_CITY_VALUE = '__otro__';
