export interface ElectrodeData {
  id: string;
  name: string;
  process: string;
  description: string;
  minAmperage: number;
  maxAmperage: number;
  diameter: string;
}

export const ELECTRODES: ElectrodeData[] = [
  { id: 'E6013', name: 'E6013', process: 'SMAW', description: 'All-position, easy slag removal', minAmperage: 70, maxAmperage: 150, diameter: '3.2mm' },
  { id: 'E7018', name: 'E7018', process: 'SMAW', description: 'Low hydrogen, structural quality', minAmperage: 100, maxAmperage: 200, diameter: '3.2mm' },
  { id: 'ER70S-6', name: 'ER70S-6', process: 'MIG', description: 'Most popular MIG wire, all steels', minAmperage: 80, maxAmperage: 200, diameter: '0.9mm' },
  { id: 'E71T-1', name: 'E71T-1', process: 'FCAW', description: 'Flux-core, good penetration', minAmperage: 120, maxAmperage: 250, diameter: '1.2mm' },
  { id: 'ER308L', name: 'ER308L', process: 'TIG', description: 'Stainless steel TIG filler', minAmperage: 40, maxAmperage: 120, diameter: '2.4mm' },
  { id: 'E316L-W', name: 'E316L-W', process: 'WET_SMAW', description: 'Wet welding electrode, waterproof flux', minAmperage: 100, maxAmperage: 200, diameter: '4mm' },
];
