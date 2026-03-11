export interface MetalProperties {
  id: string;
  name: string;
  thickness: number; // mm
  thermalConductivity: number; // W/(m·K)
  meltingPoint: number; // °C
  heatCapacity: number; // J/(kg·K)
  burnThroughTemp: number; // °C (surface)
  color: string; // base color hex
}

export const METALS: Record<string, MetalProperties> = {
  mild_steel_thick: {
    id: 'mild_steel_thick',
    name: 'Mild Steel (Thick)',
    thickness: 12,
    thermalConductivity: 50,
    meltingPoint: 1480,
    heatCapacity: 490,
    burnThroughTemp: 1500,
    color: '#5a5a5a',
  },
  mild_steel_thin: {
    id: 'mild_steel_thin',
    name: 'Mild Steel (Thin)',
    thickness: 1.5,
    thermalConductivity: 50,
    meltingPoint: 1480,
    heatCapacity: 490,
    burnThroughTemp: 900,
    color: '#6a6a6a',
  },
  structural_steel: {
    id: 'structural_steel',
    name: 'Structural Steel',
    thickness: 8,
    thermalConductivity: 45,
    meltingPoint: 1500,
    heatCapacity: 500,
    burnThroughTemp: 1400,
    color: '#4a4a4a',
  },
  stainless_pipe: {
    id: 'stainless_pipe',
    name: 'Stainless Steel Pipe',
    thickness: 4,
    thermalConductivity: 16,
    meltingPoint: 1400,
    heatCapacity: 500,
    burnThroughTemp: 1100,
    color: '#8a8a8a',
  },
  stainless_steel: {
    id: 'stainless_steel',
    name: 'Stainless Steel',
    thickness: 6,
    thermalConductivity: 16,
    meltingPoint: 1400,
    heatCapacity: 500,
    burnThroughTemp: 1200,
    color: '#909090',
  },
};
